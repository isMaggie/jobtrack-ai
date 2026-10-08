import { describe, expect, it } from "vitest";
import { applicationDraftSchema, draftToFormValues, draftReviewMessage, emailInputSchema } from "./application-draft";

const draft = { company: " Example ", position: "Engineer", appliedDate: "2024-02-29", jobUrl: null, jobDescription: null };
describe("email drafts", () => {
  it("accepts incomplete drafts and converts null to empty form values", () => {
    const value = applicationDraftSchema.parse({ ...draft, appliedDate: null });
    expect(draftToFormValues(value)).toEqual({ company: "Example", position: "Engineer", appliedDate: "", jobUrl: "", jobDescription: "" });
    expect(draftReviewMessage(value)).toContain("missing applied date");
  });
  it.each(["", "  ", "x".repeat(20_001)])("rejects blank or oversized emails", (emailText) => {
    expect(emailInputSchema.safeParse({ emailText }).success).toBe(false);
  });
  it("accepts the email boundary and rejects extra keys", () => {
    expect(emailInputSchema.parse({ emailText: "x".repeat(20_000) }).emailText).toHaveLength(20_000);
    expect(emailInputSchema.safeParse({ emailText: "email", status: "OFFER" }).success).toBe(false);
  });
  it.each([
    { appliedDate: "2026-02-30" }, { appliedDate: "October 8" },
    { jobUrl: "javascript:alert(1)" }, { jobUrl: "ftp://example.com" },
    { company: "x".repeat(201) }, { position: " " },
    { jobDescription: "x".repeat(20_001) }, { jobUrl: `https://example.com/${"x".repeat(2048)}` },
    { status: "OFFER" }, { company: undefined },
  ])("rejects invalid extracted values", (overrides) => {
    expect(applicationDraftSchema.safeParse({ ...draft, ...overrides }).success).toBe(false);
  });
});
