import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import pg from "pg";
import { migrate } from "./migrate.mjs";

if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required; no development fallback");
const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS name");
  if (result.rows[0].name !== "jobtrack_ai_test") throw new Error("E2E requires jobtrack_ai_test");
  await migrate(client);
} finally {
  await client.end();
}
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: connectionString, TEST_DATABASE_URL: connectionString,
    GMAIL_CLIENT_ID: "fake-client", GMAIL_CLIENT_SECRET: "fake-secret",
    GMAIL_REDIRECT_URI: "http://127.0.0.1:3100/gmail/callback", GMAIL_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"),
    GMAIL_TEST_ORIGIN: "http://127.0.0.1:3101",
    APP_ACCESS_PASSWORD: "e2e-only-password", OPENAI_API_KEY: "e2e-dummy-key", OPENAI_BASE_URL: "http://127.0.0.1:3101/v1" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
