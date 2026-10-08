import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApplication, getApplicationById, listApplications, updateApplicationStatus } from "./application-repository";
import { type ApplicationStatus } from "./application";
import { getPool } from "./db";

const input = {
  company: "Example Company",
  position: "Engineer",
  appliedDate: new Date("2026-10-07T18:23:45.000Z"),
};

beforeAll(async () => {
  const result = await getPool().query("SELECT current_database() AS name");
  if (result.rows[0].name !== "jobtrack_ai_test") throw new Error("Tests require jobtrack_ai_test");
});
beforeEach(async () => { await getPool().query("DELETE FROM applications"); });
afterAll(async () => { await getPool().end(); });

describe("application persistence", () => {
  it("lists an empty database and orders applications newest first with an ID tie-breaker", async () => {
    expect(await listApplications()).toEqual([]);
    const first = await createApplication(input);
    const second = await createApplication({ ...input, company: "Second" });
    await getPool().query("UPDATE applications SET created_at = $1 WHERE id = $2", ["2026-01-01T00:00:00Z", first.id]);
    await getPool().query("UPDATE applications SET created_at = $1 WHERE id = $2", ["2026-01-02T00:00:00Z", second.id]);
    expect((await listApplications()).map((record) => record.id)).toEqual([second.id, first.id]);
    await getPool().query("UPDATE applications SET created_at = $1", ["2026-01-01T00:00:00Z"]);
    expect((await listApplications()).map((record) => record.id)).toEqual([first.id, second.id].sort().reverse());
  });

  it("persists status changes and advances updatedAt without changing other fields", async () => {
    const created = await createApplication({ ...input, jobDescription: "Description", jobUrl: "https://example.com" });
    await getPool().query("UPDATE applications SET updated_at = $1 WHERE id = $2", ["2000-01-01T00:00:00Z", created.id]);
    const updated = await updateApplicationStatus(created.id, "INTERVIEW");
    expect(updated).toEqual({ ...created, status: "INTERVIEW", updatedAt: expect.any(Date) });
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(new Date("2000-01-01T00:00:00Z").getTime());
    expect(await getApplicationById(created.id)).toEqual(updated);
    expect(await listApplications()).toEqual([updated]);
  });

  it("returns null for missing updates and rejects invalid updates without changing data", async () => {
    const created = await createApplication(input);
    expect(await updateApplicationStatus(randomUUID(), "OFFER")).toBeNull();
    await expect(updateApplicationStatus("bad", "OFFER")).rejects.toThrow();
    await expect(updateApplicationStatus(created.id, "PENDING" as ApplicationStatus)).rejects.toThrow();
    expect(await getApplicationById(created.id)).toEqual(created);
  });

  it("creates a record with defaults and reads it through another connection", async () => {
    const created = await createApplication({ ...input, company: "  Example Company  " });
    expect(created).toMatchObject({ company: input.company, status: "APPLIED", jobDescription: undefined, jobUrl: undefined });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toEqual(created.createdAt);
    expect(await getApplicationById(created.id)).toEqual(created);
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      const stored = await client.query("SELECT id FROM applications WHERE id = $1", [created.id]);
      expect(stored.rows).toEqual([{ id: created.id }]);
    } finally { await client.end(); }
  });

  it("round trips optional fields, explicit status, and SQL-looking text", async () => {
    const created = await createApplication({ ...input, company: "Example'); DROP TABLE applications; --", jobDescription: "", jobUrl: "https://example.com/jobs/123", status: "INTERVIEW" });
    expect(await getApplicationById(created.id)).toEqual(created);
    expect(created.jobDescription).toBe("");
    expect(created.status).toBe("INTERVIEW");
  });

  it.each(["2026-10-07T23:59:59.000Z", "2026-01-01T00:30:00+05:00", "2024-02-29T12:00:00Z"])("maps calendar dates consistently for %s", async (value) => {
    const appliedDate = new Date(value);
    const created = await createApplication({ ...input, appliedDate });
    expect(created.appliedDate.toISOString()).toBe(`${appliedDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
    expect((await getApplicationById(created.id))?.appliedDate).toEqual(created.appliedDate);
  });

  it("returns null for an unknown UUID", async () => {
    expect(await getApplicationById(randomUUID())).toBeNull();
  });

  it("rejects invalid input without inserting a record", async () => {
    await expect(createApplication({ ...input, company: " \t\n" })).rejects.toThrow();
    await expect(createApplication({ ...input, jobUrl: "ftp://example.com" })).rejects.toThrow();
    await expect(createApplication({ ...input, appliedDate: new Date("invalid") })).rejects.toThrow();
    await expect(getApplicationById("invalid")).rejects.toThrow();
    expect((await getPool().query("SELECT count(*)::int AS count FROM applications")).rows[0].count).toBe(0);
  });

  it("applies database defaults and nullable fields to direct inserts", async () => {
    const result = await getPool().query(
      "INSERT INTO applications (id, company, position, applied_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [randomUUID(), input.company, input.position, "2026-10-07"],
    );
    expect(result.rows[0]).toMatchObject({ status: "APPLIED", job_description: null, job_url: null });
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
    expect(result.rows[0].updated_at).toEqual(result.rows[0].created_at);
  });

  it.each([
    ["company", null, "23502"], ["position", null, "23502"],
    ["company", " \t\n", "23514"], ["position", "", "23514"],
    ["company", "x".repeat(201), "22001"], ["position", "x".repeat(201), "22001"],
    ["status", "PENDING", "23514"], ["status", null, "23502"],
    ["applied_date", null, "23502"], ["applied_date", "2026-02-30", "22008"],
  ])("enforces the %s constraint", async (column, value, code) => {
    // Column names come only from this fixed test list, never user input.
    const values: Record<string, unknown> = { company: input.company, position: input.position, status: "APPLIED", applied_date: "2026-10-07" };
    values[column as string] = value;
    await expect(getPool().query(
      "INSERT INTO applications (id, company, position, status, applied_date) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), values.company, values.position, values.status, values.applied_date],
    )).rejects.toMatchObject({ code });
  });

  it("rejects duplicate primary keys", async () => {
    const created = await createApplication(input);
    await expect(getPool().query(
      "INSERT INTO applications (id, company, position, applied_date) VALUES ($1, $2, $3, $4)",
      [created.id, input.company, input.position, "2026-10-07"],
    )).rejects.toMatchObject({ code: "23505" });
  });
});
