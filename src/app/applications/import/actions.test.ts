import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractEmailAction } from "./actions";
import { extractApplicationDraft } from "../../../lib/email-extraction";
import { createApplication } from "../../../lib/application-repository";
vi.mock("../../../lib/email-extraction", () => ({ extractApplicationDraft: vi.fn() }));
vi.mock("../../../lib/application-repository", () => ({ createApplication: vi.fn() }));
function form(emailText = "Thank you for applying to Example as Engineer.") { const data = new FormData(); data.set("emailText", emailText); return data; }
beforeEach(() => vi.resetAllMocks());
describe("email import action", () => {
  it("returns an editable draft without writing", async () => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ company: "Example", position: null, appliedDate: null, jobUrl: null, jobDescription: null });
    expect(await extractEmailAction(form())).toMatchObject({ values: { company: "Example", position: "", appliedDate: "" }, message: expect.stringContaining("Nothing has been saved") });
    expect(createApplication).not.toHaveBeenCalled();
  });
  it.each([" ", "x".repeat(20_001)])("rejects invalid input without an AI call", async (email) => {
    expect(await extractEmailAction(form(email))).toHaveProperty("error");
    expect(extractApplicationDraft).not.toHaveBeenCalled();
  });
  it("rejects file input", async () => {
    const data = form(); data.set("emailText", new Blob(["email"]), "email.txt");
    expect(await extractEmailAction(data)).toHaveProperty("error");
    expect(extractApplicationDraft).not.toHaveBeenCalled();
  });
  it("validates output even at the action boundary", async () => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ company: "Example", position: null, appliedDate: "2026-02-30", jobUrl: null, jobDescription: null });
    expect(await extractEmailAction(form())).not.toHaveProperty("values");
    expect(createApplication).not.toHaveBeenCalled();
  });
  it.each(["timeout with secret", "invalid JSON with secret", "rate limit with secret"])("does not expose provider errors", async (message) => {
    vi.mocked(extractApplicationDraft).mockRejectedValue(new Error(message));
    const result = await extractEmailAction(form());
    expect(result.error).toContain("Try again");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(createApplication).not.toHaveBeenCalled();
  });
  it("explains missing configuration", async () => {
    vi.mocked(extractApplicationDraft).mockRejectedValue(new Error("AI_NOT_CONFIGURED"));
    expect(await extractEmailAction(form())).toMatchObject({ error: expect.stringContaining("not configured") });
  });
});
