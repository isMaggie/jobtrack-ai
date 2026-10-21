import { randomUUID } from "node:crypto";
import { Client } from "pg";

export async function query(sql: string, values: unknown[] = []) {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await client.connect();
    if ((await client.query("SELECT current_database() AS name")).rows[0].name !== "jobtrack_ai_test") {
      throw new Error("E2E requires jobtrack_ai_test");
    }
    return await client.query(sql, values);
  } finally { await client.end(); }
}

export async function seedApplication() {
  const id = randomUUID();
  await query("INSERT INTO applications (id, company, position, applied_date, job_description) VALUES ($1, $2, $3, $4, $5)",
    [id, "Example Company", "Engineer", "2026-10-07", "Build useful software"]);
  return id;
}

export async function applications() {
  return (await query("SELECT * FROM applications ORDER BY id")).rows;
}
