import { beforeEach, afterAll, afterEach, expect, it, vi } from "vitest";
import { createApplication, deleteApplication } from "./application-repository";
import { getPool } from "./db";
import { connectGmail, decryptTokens, syncGmail, GMAIL_SCOPE } from "./gmail";
import { extractApplicationDraft } from "./email-extraction";

vi.mock("./email-extraction", () => ({ extractApplicationDraft: vi.fn() }));
const draft = { emailType: "APPLICATION_CONFIRMATION" as const, company: "Example", position: "Engineer", appliedDate: "2026-10-07", jobUrl: null, jobDescription: null };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  expect((await getPool().query("SELECT current_database() AS name")).rows[0].name).toBe("jobtrack_ai_test");
  await getPool().query("TRUNCATE gmail_connection,gmail_imports,applications");
  vi.stubEnv("GMAIL_CLIENT_ID", "fake"); vi.stubEnv("GMAIL_CLIENT_SECRET", "fake-secret");
  vi.stubEnv("GMAIL_REDIRECT_URI", "http://localhost/gmail/callback");
  vi.stubEnv("GMAIL_TOKEN_KEY", Buffer.alloc(32, 1).toString("base64"));
  fetcher = vi.fn(async (url: string) => {
    const data = url.includes("/token") ? { access_token: "access-secret", refresh_token: "refresh-secret", expires_in: 3600, scope: GMAIL_SCOPE }
      : url.endsWith("/profile") ? { emailAddress: "fake@example.com" }
      : url.includes("format=full") ? { payload: { mimeType: "text/plain", body: { data: Buffer.from("PRIVATE RAW BODY").toString("base64url") } } }
      : { messages: Array.from({ length: 20 }, (_, i) => ({ id: `message-${i}` })) };
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal("fetch", fetcher);
  vi.mocked(extractApplicationDraft).mockResolvedValue(draft);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
afterAll(async () => { await getPool().end(); });
it("connects with encrypted tokens; bounds sync, deduplicates, and never writes applications or raw bodies", async () => {
  await connectGmail("code", "verifier");
  const connection = (await getPool().query("SELECT * FROM gmail_connection")).rows[0];
  expect(connection.tokens).not.toContain("secret");
  expect(JSON.parse(decryptTokens(connection.tokens)).refresh_token).toBe("refresh-secret");
  expect(await syncGmail()).toBe(5);
  expect(await syncGmail()).toBe(5);
  expect(vi.mocked(extractApplicationDraft)).toHaveBeenCalledTimes(10);
  const imports = (await getPool().query("SELECT * FROM gmail_imports")).rows;
  expect(imports).toHaveLength(10);
  expect(JSON.stringify(imports)).not.toContain("PRIVATE RAW BODY");
  expect(imports[0].draft).toEqual(draft);
  expect((await getPool().query("SELECT * FROM applications")).rows).toEqual([]);
  const listUrl = fetcher.mock.calls.find(([url]) => url.includes("maxResults"))?.[0];
  expect(listUrl).toContain("maxResults=20"); expect(listUrl).toContain("newer_than%3A14d");
});
it("retries failed analyses and releases the sync lock", async () => {
  await connectGmail("code", "verifier");
  vi.mocked(extractApplicationDraft).mockRejectedValueOnce(new Error("fake provider failure"));
  await expect(syncGmail()).rejects.toThrow();
  expect((await getPool().query("SELECT * FROM gmail_imports")).rows).toEqual([]);
  expect(await syncGmail()).toBe(5);
});
it("rejects overlapping sync without duplicate analysis", async () => {
  await connectGmail("code", "verifier");
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(724019)");
    await expect(syncGmail()).rejects.toThrow("already running");
    expect(extractApplicationDraft).not.toHaveBeenCalled();
  } finally { await client.query("SELECT pg_advisory_unlock(724019)"); client.release(); }
});
it("rejects denied scope without storing credentials", async () => {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fake", refresh_token: "fake", expires_in: 3600, scope: "other" })));
  await expect(connectGmail("code", "verifier")).rejects.toThrow("permission");
  expect((await getPool().query("SELECT * FROM gmail_connection")).rows).toEqual([]);
});

it("identifies invalid-key failures as token encryption and rolls back the connection", async () => {
  vi.stubEnv("GMAIL_TOKEN_KEY", "");
  const stages: string[] = [];
  await expect(connectGmail("code", "verifier", (stage) => stages.push(stage))).rejects.toThrow("32 random bytes");
  expect(stages.at(-1)).toBe("token_encryption");
  expect((await getPool().query("SELECT * FROM gmail_connection")).rows).toEqual([]);
});

it("preserves Gmail import history and deduplication after application deletion", async () => {
  await connectGmail("code", "verifier");
  expect(await syncGmail()).toBe(5);
  const imports = (await getPool().query("SELECT * FROM gmail_imports ORDER BY message_id")).rows;
  const application = await createApplication({ company: draft.company, position: draft.position, appliedDate: new Date("2026-10-07T00:00:00Z") });
  expect(await deleteApplication(application.id)).toBe(true);
  expect((await getPool().query("SELECT * FROM gmail_imports ORDER BY message_id")).rows).toEqual(imports);
  const callsBefore = vi.mocked(extractApplicationDraft).mock.calls.length;
  // Offer only messages already imported so the next sync should do no analysis.
  const originalFetch = fetcher.getMockImplementation() as (url: string) => Promise<Response>;
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes("/token")) return originalFetch(url);
    if (url.includes("maxResults")) return new Response(JSON.stringify({ messages: imports.map((row) => ({ id: row.message_id })) }));
    throw new Error("Previously imported messages must not be fetched again");
  });
  expect(await syncGmail()).toBe(0);
  expect(vi.mocked(extractApplicationDraft)).toHaveBeenCalledTimes(callsBefore);
  expect((await getPool().query("SELECT * FROM gmail_connection")).rows).toHaveLength(1);
});
