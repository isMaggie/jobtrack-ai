import { spawn } from "node:child_process";
import pg from "pg";
import { startEmailProvider } from "../tests/e2e/helpers/email-provider-stub.mjs";

if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
    process.env.OPENAI_BASE_URL !== "http://127.0.0.1:3101/v1" || process.env.OPENAI_API_KEY !== "e2e-dummy-key") {
  throw new Error("Start E2E using npm run test:e2e");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  if ((await client.query("SELECT current_database() AS name")).rows[0].name !== "jobtrack_ai_test") {
    throw new Error("E2E requires jobtrack_ai_test");
  }
} finally { await client.end(); }
const provider = await startEmailProvider();
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: process.env,
});
function stop(signal = "SIGTERM") { app.kill(signal); provider.close(); }
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
app.on("error", (error) => { console.error(error); stop(); process.exitCode = 1; });
app.on("exit", (code) => { provider.close(); process.exitCode = code ?? 0; });
