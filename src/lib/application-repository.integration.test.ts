import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApplication, confirmImportedStatus, getApplicationById, listApplications, updateApplicationStatus } from "./application-repository";
import { type ApplicationStatus } from "./application";
import { getPool } from "./db";

import { confirmEmailStatusAction, matchEmailAction, extractEmailAction } from "../app/applications/import/actions";
import { createApplicationAction, deleteApplicationAction } from "../app/applications/actions";
import { extractApplicationDraft } from "./email-extraction";

vi.mock("./email-extraction", () => ({ extractApplicationDraft: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("test redirect"); }) }));

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

describe("email import persistence", () => {
  it("writes only after confirmation and saves the reviewed edits", async () => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ emailType: "APPLICATION_CONFIRMATION", company: "Extracted Company", position: "Engineer", appliedDate: "2026-10-08", jobUrl: null, jobDescription: null });
    const email = new FormData(); email.set("emailText", "Thank you for applying to Extracted Company as Engineer.");
    const draft = await extractEmailAction(email);
    expect(draft.values?.company).toBe("Extracted Company");
    expect(await listApplications()).toEqual([]);
    const confirmed = new FormData();
    for (const [key, value] of Object.entries(draft.values!)) confirmed.set(key, value);
    confirmed.set("company", "Reviewed Company"); confirmed.set("status", "OFFER");
    await expect(createApplicationAction({}, confirmed)).rejects.toThrow("test redirect");
    const records = await listApplications();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ company: "Reviewed Company", position: "Engineer", status: "APPLIED", appliedDate: new Date("2026-10-08T00:00:00Z") });
  });
  it("does not persist an incomplete reviewed form", async () => {
    const confirmed = new FormData(); confirmed.set("company", "Example");
    expect(await createApplicationAction({}, confirmed)).toHaveProperty("fieldErrors.position");
    expect(await listApplications()).toEqual([]);
  });
});


describe("status email persistence", () => {
  function confirmation(id: string, emailType: string, expectedStatus = "APPLIED") {
    const data = new FormData();
    Object.entries({ id, emailType, expectedStatus, company: input.company, position: input.position, confirm: "yes" }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  it.each(["INTERVIEW", "OFFER", "REJECTION"] as const)("updates only the selected record after %s confirmation", async (emailType) => {
    const first = await createApplication(input);
    const second = await createApplication(input);
    vi.mocked(extractApplicationDraft).mockResolvedValue({ emailType, company: input.company, position: input.position, appliedDate: null, jobUrl: null, jobDescription: null });
    const email = new FormData(); email.set("emailText", "Application progress email");
    const review = await extractEmailAction(email);
    expect(review.matches).toHaveLength(2);
    expect(await getApplicationById(first.id)).toEqual(first);
    expect(await getApplicationById(second.id)).toEqual(second);
    const data = confirmation(second.id, emailType);
    expect((await matchEmailAction(data)).matches).toHaveLength(2);
    expect(await confirmEmailStatusAction(data)).toEqual({ message: "Status updated." });
    expect(await getApplicationById(first.id)).toEqual(first);
    const updated = await getApplicationById(second.id);
    expect(updated).toEqual({ ...second, status: emailType === "REJECTION" ? "REJECTED" : emailType, updatedAt: expect.any(Date) });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(second.updatedAt.getTime());
    data.set("expectedStatus", updated!.status);
    expect(await confirmEmailStatusAction(data)).toMatchObject({ message: expect.stringContaining("Already") });
    expect(await getApplicationById(second.id)).toEqual(updated);
  });
  it("rejects stale proposals and missing explicit confirmation without writing", async () => {
    const created = await createApplication(input);
    const data = confirmation(created.id, "OFFER"); data.delete("confirm");
    expect(await confirmEmailStatusAction(data)).toHaveProperty("error");
    expect(await getApplicationById(created.id)).toEqual(created);
    await updateApplicationStatus(created.id, "REJECTED");
    data.set("confirm", "yes");
    expect(await confirmEmailStatusAction(data)).toHaveProperty("error");
    expect((await getApplicationById(created.id))!.status).toBe("REJECTED");
  });
});


describe("email lifecycle safeguards", () => {
  it.each(["INTERVIEW", "OTHER"] as const)("does not persist %s analysis without a match", async (emailType) => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ emailType, company: input.company, position: input.position, appliedDate: null, jobUrl: null, jobDescription: null });
    const data = new FormData(); data.set("emailText", "Application email");
    const result = await extractEmailAction(data);
    expect(result.emailType).toBe(emailType);
    if (emailType === "INTERVIEW") expect(result.matches).toEqual([]);
    expect(await listApplications()).toEqual([]);
  });
  it("rejects changes occurring after the review read", async () => {
    const created = await createApplication(input);
    await updateApplicationStatus(created.id, "REJECTED");
    expect(await confirmImportedStatus(created.id, "OFFER", "APPLIED", created)).toBeNull();
    expect((await getApplicationById(created.id))!.status).toBe("REJECTED");
    await updateApplicationStatus(created.id, "APPLIED");
    await getPool().query("UPDATE applications SET company = $1 WHERE id = $2", ["Different Company", created.id]);
    expect(await confirmImportedStatus(created.id, "OFFER", "APPLIED", created)).toBeNull();
    expect((await getApplicationById(created.id))!.status).toBe("APPLIED");
    await getPool().query("UPDATE applications SET company = $1, position = $2 WHERE id = $3", [created.company, "Different Position", created.id]);
    expect(await confirmImportedStatus(created.id, "OFFER", "APPLIED", created)).toBeNull();
    expect((await getApplicationById(created.id))!.status).toBe("APPLIED");
  });
  it("does not touch timestamps when the conditional write is a no-op", async () => {
    const created = await createApplication(input);
    expect(await confirmImportedStatus(created.id, "APPLIED", "APPLIED", created)).toBeNull();
    expect(await getApplicationById(created.id)).toEqual(created);
  });
});

describe("application deletion", () => {
  it("requires confirmation and deletes only the selected application through the action", async () => {
    const first = await createApplication(input);
    const second = await createApplication(input);
    const data = new FormData();
    expect(await deleteApplicationAction(second.id, {}, data)).toHaveProperty("error");
    data.set("confirm", "yes");
    expect(await deleteApplicationAction("invalid", {}, data)).toHaveProperty("error");
    expect(await getApplicationById(second.id)).toEqual(second);
    await expect(deleteApplicationAction(second.id, {}, data)).rejects.toThrow("test redirect");
    expect(await getApplicationById(second.id)).toBeNull();
    expect(await listApplications()).toEqual([first]);
    expect(await deleteApplicationAction(second.id, {}, data)).toEqual({ error: "This application no longer exists." });
    expect(await getApplicationById(first.id)).toEqual(first);
  });
});
