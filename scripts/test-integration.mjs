import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { migrate } from "./migrate.mjs";

if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required; no development database fallback is allowed");
const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS name");
  if (result.rows[0].name !== "jobtrack_ai_test") throw new Error("Integration tests require jobtrack_ai_test");
  await migrate(client);
} finally {
  await client.end();
}
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.mts"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: connectionString },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
