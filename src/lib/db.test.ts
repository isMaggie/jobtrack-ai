import { afterEach, expect, it, vi } from "vitest";
const { pool } = vi.hoisted(() => ({ pool: vi.fn(class { on = vi.fn(); }) }));
vi.mock("pg", () => ({ Pool: pool }));
import { getPool } from "./db";
afterEach(() => {
  delete (globalThis as typeof globalThis & { applicationPool?: unknown }).applicationPool;
  vi.unstubAllEnvs(); vi.clearAllMocks();
});
it("bounds connection waits and reuses the pool", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test-only");
  expect(getPool()).toBe(getPool());
  expect(pool).toHaveBeenCalledExactlyOnceWith({ connectionString: "postgresql://test-only", max: 5, connectionTimeoutMillis: 5_000 });
});
