import "server-only";
import { Pool } from "pg";

const databaseGlobal = globalThis as typeof globalThis & { applicationPool?: Pool };

export function getPool(): Pool {
  if (!databaseGlobal.applicationPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    const pool = new Pool({ connectionString, max: 5 });
    pool.on("error", () => console.error("An idle database connection failed"));
    databaseGlobal.applicationPool = pool;
  }
  return databaseGlobal.applicationPool;
}
