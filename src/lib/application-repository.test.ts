import { beforeEach, expect, it, vi } from "vitest";
import { getPool } from "./db";
import { deleteApplication } from "./application-repository";

vi.mock("./db", () => ({ getPool: vi.fn() }));
const query = vi.fn();
const id = "550e8400-e29b-41d4-a716-446655440000";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPool).mockReturnValue({ query } as unknown as ReturnType<typeof getPool>);
});
it("rejects invalid IDs before accessing the database", async () => {
  await expect(deleteApplication("invalid")).rejects.toThrow();
  expect(getPool).not.toHaveBeenCalled();
});
it("deletes using only the selected ID as a query parameter", async () => {
  query.mockResolvedValue({ rows: [{ id }] });
  expect(await deleteApplication(id)).toBe(true);
  expect(query).toHaveBeenCalledExactlyOnceWith("DELETE FROM applications WHERE id = $1 RETURNING id", [id]);
});
it("returns false when no application was deleted", async () => {
  query.mockResolvedValue({ rows: [] });
  expect(await deleteApplication(id)).toBe(false);
});
