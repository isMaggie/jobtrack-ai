import { describe, expect, it } from "vitest";
import { emailTypeSchema, matchingApplications, normalizeMatch, proposedStatus } from "./email-import";
import type { Application } from "./application";
const record = { company: "Example Inc.", position: "Senior Engineer" } as Application;
describe("email import rules", () => {
  it.each([
    ["APPLICATION_CONFIRMATION", null], ["INTERVIEW", "INTERVIEW"], ["OFFER", "OFFER"], ["REJECTION", "REJECTED"], ["OTHER", null],
  ] as const)("maps %s to %s", (type, status) => expect(proposedStatus(type)).toBe(status));
  it("rejects unknown classifications", () => expect(emailTypeSchema.safeParse("REJECTED").success).toBe(false));
  it("normalizes whitespace and case only", () => {
    expect(normalizeMatch("  Senior\n Engineer ")).toBe("senior engineer");
    expect(matchingApplications([record], " EXAMPLE inc. ", "senior  engineer")).toEqual([record]);
    expect(matchingApplications([record], "Example", "Senior Engineer")).toEqual([]);
    expect(matchingApplications([record], "Example Inc.", "Engineer")).toEqual([]);
    expect(matchingApplications([record], "", "Senior Engineer")).toEqual([]);
  });
  it("preserves multiple matches for explicit selection", () => expect(matchingApplications([record, record], record.company, record.position)).toHaveLength(2));
});
