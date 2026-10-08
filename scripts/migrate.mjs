import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

export async function migrate(client) {
  const directory = new URL("../db/migrations/", import.meta.url);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const files = (await readdir(directory)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
  for (const filename of files) {
    const existing = await client.query("SELECT filename FROM schema_migrations WHERE filename = $1", [filename]);
    if (existing.rowCount) continue;
    const sql = await readFile(new URL(filename, directory), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await migrate(client);
  } finally {
    await client.end();
  }
}
