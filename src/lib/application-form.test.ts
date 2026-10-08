import { describe, expect, it } from "vitest";
import { parseApplicationForm } from "./application-form";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ company: " Example ", position: " Engineer ", appliedDate: "2024-02-29", jobUrl: "", jobDescription: "", ...overrides })) data.set(key, value);
  return data;
}

describe("application form", () => {
  it("normalizes strings, optional fields, and calendar dates, and ignores submitted status", () => {
    expect(parseApplicationForm(form({ status: "OFFER" }))).toMatchObject({ success: true, data: {
      company: "Example", position: "Engineer", status: "APPLIED", jobUrl: undefined, jobDescription: undefined, appliedDate: new Date("2024-02-29T00:00:00Z"),
    } });
  });
  it("preserves description formatting and trims URLs", () => {
    expect(parseApplicationForm(form({ jobDescription: "  Line one\nLine two  ", jobUrl: " https://example.com/job " }))).toMatchObject({ success: true, data: { jobDescription: "  Line one\nLine two  ", jobUrl: "https://example.com/job" } });
  });
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "", "10/08/2026"])("rejects invalid date %s", (appliedDate) => {
    expect(parseApplicationForm(form({ appliedDate }))).toMatchObject({ success: false, fieldErrors: { appliedDate: expect.any(Array) } });
  });
  it.each(["company", "position", "appliedDate"])("rejects missing %s", (field) => {
    const data = form(); data.delete(field);
    expect(parseApplicationForm(data)).toMatchObject({ success: false, fieldErrors: { [field]: expect.any(Array) } });
  });
  it.each<Record<string, string>>([{ company: "   " }, { position: "x".repeat(201) }, { jobUrl: "javascript:alert(1)" }])("returns field errors and submitted values for %j", (values) => {
    expect(parseApplicationForm(form(values))).toMatchObject({ success: false, values });
  });
  it.each(["company", "position", "appliedDate", "jobUrl", "jobDescription"])("rejects a file in %s", (field) => {
    const data = form(); data.set(field, new Blob(["text"]), "text.txt");
    expect(parseApplicationForm(data)).toMatchObject({ success: false, fieldErrors: { [field]: expect.any(Array) } });
  });
});
