import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApplicationAction, updateApplicationStatusAction, deleteApplicationAction } from "./actions";
import { createApplication, updateApplicationStatus, deleteApplication } from "../../lib/application-repository";
import { requireAppAccess } from "../../lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

vi.mock("../../lib/application-repository", () => ({ createApplication: vi.fn(), updateApplicationStatus: vi.fn(), deleteApplication: vi.fn() }));
vi.mock("../../lib/access", () => ({ requireAppAccess: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
const id = "550e8400-e29b-41d4-a716-446655440000";
function form() {
  const data = new FormData();
  data.set("company", "Example"); data.set("position", "Engineer"); data.set("appliedDate", "2026-10-08");
  return data;
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(redirect).mockImplementation(() => { throw new Error("redirect"); }); });

describe("application actions", () => {
  it("does not write invalid creation input", async () => {
    expect(await createApplicationAction({}, new FormData())).toHaveProperty("fieldErrors.company");
    expect(createApplication).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("creates with APPLIED, revalidates, and redirects outside the catch block", async () => {
    vi.mocked(createApplication).mockResolvedValue({ id } as Awaited<ReturnType<typeof createApplication>>);
    const data = form(); data.set("status", "OFFER");
    await expect(createApplicationAction({}, data)).rejects.toThrow("redirect");
    expect(createApplication).toHaveBeenCalledWith(expect.objectContaining({ status: "APPLIED" }));
    expect(revalidatePath).toHaveBeenCalledWith("/"); expect(redirect).toHaveBeenCalledWith(`/applications/${id}`);
  });
  it("preserves creation input on a database failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(createApplication).mockRejectedValue(new Error("secret connection details"));
      expect(await createApplicationAction({}, form())).toMatchObject({ values: { company: "Example" }, message: "Couldn’t save the application. Please try again." });
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("rejects invalid IDs and statuses without writing", async () => {
    const data = new FormData(); data.set("status", "OFFER");
    expect(await updateApplicationStatusAction("bad", {}, data)).toHaveProperty("error");
    data.set("status", "PENDING");
    expect(await updateApplicationStatusAction(id, {}, data)).toHaveProperty("error");
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });
  it("refreshes both views after updating status", async () => {
    vi.mocked(updateApplicationStatus).mockResolvedValue({ id } as Awaited<ReturnType<typeof createApplication>>);
    const data = new FormData(); data.set("status", "INTERVIEW");
    expect(await updateApplicationStatusAction(id, {}, data)).toEqual({ message: "Status updated." });
    expect(updateApplicationStatus).toHaveBeenCalledWith(id, "INTERVIEW");
    expect(revalidatePath).toHaveBeenCalledWith("/"); expect(revalidatePath).toHaveBeenCalledWith(`/applications/${id}`);
  });
  it("reports a missing record without revalidation", async () => {
    vi.mocked(updateApplicationStatus).mockResolvedValue(null);
    const data = new FormData(); data.set("status", "OFFER");
    expect(await updateApplicationStatusAction(id, {}, data)).toEqual({ error: "This application no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

function deletionForm() {
  const data = new FormData(); data.set("confirm", "yes"); return data;
}

describe("delete application action", () => {
  it("rejects invalid IDs and missing or incorrect confirmation without deleting", async () => {
    expect(await deleteApplicationAction("bad", {}, deletionForm())).toEqual({ error: "Invalid application ID." });
    for (const value of [null, "no", "true"]) {
      const data = new FormData(); if (value !== null) data.set("confirm", value);
      expect(await deleteApplicationAction(id, {}, data)).toHaveProperty("error");
    }
    expect(deleteApplication).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("deletes the bound ID, refreshes both views, and redirects to the dashboard", async () => {
    vi.mocked(deleteApplication).mockResolvedValue(true);
    const data = deletionForm(); data.set("id", "another-id");
    await expect(deleteApplicationAction(id, {}, data)).rejects.toThrow("redirect");
    expect(deleteApplication).toHaveBeenCalledExactlyOnceWith(id);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(`/applications/${id}`);
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/");
  });
  it("reports a missing application without redirecting", async () => {
    vi.mocked(deleteApplication).mockResolvedValue(false);
    expect(await deleteApplicationAction(id, {}, deletionForm())).toEqual({ error: "This application no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("handles database failures without exposing details or redirecting", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(deleteApplication).mockRejectedValue(new Error("secret database details"));
      expect(await deleteApplicationAction(id, {}, deletionForm())).toEqual({ error: "Couldn’t delete the application. Please try again." });
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});

it("denies deletion before writing when access is unauthorized", async () => {
  vi.mocked(requireAppAccess).mockRejectedValueOnce(new Error("Application access denied"));
  await expect(deleteApplicationAction(id, {}, deletionForm())).rejects.toThrow("Application access denied");
  expect(deleteApplication).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});
