import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmEmailStatusAction, extractEmailAction, matchEmailAction } from "./actions";
import { extractApplicationDraft } from "../../../lib/email-extraction";
import { confirmImportedStatus, createApplication, getApplicationById, listApplications } from "../../../lib/application-repository";
import type { Application } from "../../../lib/application";
vi.mock("../../../lib/email-extraction", () => ({ extractApplicationDraft: vi.fn() }));
vi.mock("../../../lib/application-repository", () => ({ confirmImportedStatus: vi.fn(), createApplication: vi.fn(), getApplicationById: vi.fn(), listApplications: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const application = { id: "11111111-1111-4111-8111-111111111111", company: "Example", position: "Engineer", status: "APPLIED", appliedDate: new Date("2026-01-01") } as Application;
function form() {
  const data = new FormData();
  Object.entries({ company: "Example", position: "Engineer", emailType: "INTERVIEW", id: application.id, expectedStatus: "APPLIED", confirm: "yes", emailText: "Interview invitation" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(listApplications).mockResolvedValue([application]);
  vi.mocked(getApplicationById).mockResolvedValue(application);
  vi.mocked(confirmImportedStatus).mockResolvedValue({ ...application, status: "INTERVIEW" });
});
describe("status email review", () => {
  it.each(["APPLICATION_CONFIRMATION", "INTERVIEW", "OFFER", "REJECTION", "OTHER"] as const)("analyzes %s without writing", async (emailType) => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ emailType, company: "Example", position: "Engineer", appliedDate: null, jobUrl: null, jobDescription: null });
    expect(await extractEmailAction(form())).toMatchObject({ emailType });
    expect(createApplication).not.toHaveBeenCalled(); expect(confirmImportedStatus).not.toHaveBeenCalled();
    if (emailType === "OTHER") expect(listApplications).not.toHaveBeenCalled();
  });
  it("shows a duplicate warning for a confirmation without creating a record", async () => {
    vi.mocked(extractApplicationDraft).mockResolvedValue({ emailType: "APPLICATION_CONFIRMATION", company: "Example", position: "Engineer", appliedDate: null, jobUrl: null, jobDescription: null });
    expect(await extractEmailAction(form())).toMatchObject({ message: expect.stringContaining("already exists") });
    expect(createApplication).not.toHaveBeenCalled();
  });
  it("returns no match without creating an application", async () => {
    vi.mocked(listApplications).mockResolvedValue([]);
    expect(await matchEmailAction(form())).toMatchObject({ matches: [] });
    expect(createApplication).not.toHaveBeenCalled();
    expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
  it.each(["OTHER", "APPLICATION_CONFIRMATION", "UNKNOWN"])("rejects %s as a status confirmation", async (type) => {
    const data = form(); data.set("emailType", type);
    expect(await confirmEmailStatusAction(data)).toHaveProperty("error");
    expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
  it("returns safe errors for lookup and save failures", async () => {
    vi.mocked(listApplications).mockRejectedValue(new Error("private connection details"));
    expect(await matchEmailAction(form())).toEqual({ error: "Couldn’t find applications. Try again." });
    vi.mocked(confirmImportedStatus).mockRejectedValue(new Error("private connection details"));
    expect(await confirmEmailStatusAction(form())).toEqual({ error: "Couldn’t update the status. Try again." });
  });
  it("returns every matching record without updating", async () => {
    vi.mocked(listApplications).mockResolvedValue([application, { ...application, id: "22222222-2222-4222-8222-222222222222" }]);
    expect((await matchEmailAction(form())).matches).toHaveLength(2);
    expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
  it.each(["INTERVIEW", "OFFER", "REJECTION"] as const)("confirms %s using the server status mapping", async (type) => {
    const data = form(); data.set("emailType", type);
    expect(await confirmEmailStatusAction(data)).toEqual({ message: "Status updated." });
    expect(confirmImportedStatus).toHaveBeenCalledWith(application.id, type === "REJECTION" ? "REJECTED" : type, "APPLIED", application);
  });
  it.each(["confirm", "id", "expectedStatus", "company", "position", "emailType"])("rejects missing %s without writing", async (field) => {
    const data = form(); data.delete(field);
    expect(await confirmEmailStatusAction(data)).toHaveProperty("error"); expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
  it("rejects mismatched, deleted, and stale records", async () => {
    for (const value of [null, { ...application, company: "Other" }, { ...application, status: "OFFER" as const }]) {
      vi.mocked(getApplicationById).mockResolvedValue(value);
      expect(await confirmEmailStatusAction(form())).toHaveProperty("error");
    }
    expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
  it("reports a race during confirmation", async () => {
    vi.mocked(confirmImportedStatus).mockResolvedValue(null);
    expect(await confirmEmailStatusAction(form())).toHaveProperty("error");
  });
  it("does not write an already current status", async () => {
    const data = form(); data.set("expectedStatus", "INTERVIEW");
    vi.mocked(getApplicationById).mockResolvedValue({ ...application, status: "INTERVIEW" });
    expect(await confirmEmailStatusAction(data)).toMatchObject({ message: expect.stringContaining("Already") });
    expect(confirmImportedStatus).not.toHaveBeenCalled();
  });
});
