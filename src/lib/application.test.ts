import { describe, expect, it } from "vitest";
import {
  applicationInputSchema,
  applicationSchema,
  type Application,
} from "./application";

const validInput = {
  company: "Example Company",
  position: "Software Engineer",
  appliedDate: new Date("2026-10-07T00:00:00Z"),
};

describe("applicationInputSchema", () => {
  it("accepts valid input with optional fields", () => {
    const input = {
      ...validInput,
      jobDescription: "Build accessible web applications.",
      jobUrl: "https://example.com/jobs/123",
      status: "INTERVIEW",
    };
    expect(applicationInputSchema.parse(input)).toEqual(input);
  });

  it("allows optional fields to be omitted and defaults status to APPLIED", () => {
    expect(applicationInputSchema.parse(validInput)).toEqual({
      ...validInput,
      status: "APPLIED",
    });
  });

  it("trims company and position", () => {
    expect(applicationInputSchema.parse({
      ...validInput,
      company: "  Example Company \n",
      position: "\t Software Engineer  ",
    })).toMatchObject(validInput);
  });

  describe.each(["company", "position"] as const)("%s", (field) => {
    it.each([undefined, "", " \t\n ", "x".repeat(201)])(
      "rejects missing, blank, or too-long values: %j",
      (value) => {
        const result = applicationInputSchema.safeParse({ ...validInput, [field]: value });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toEqual([field]);
        }
      },
    );

    it("accepts 200 characters after trimming", () => {
      const result = applicationInputSchema.parse({ ...validInput, [field]: ` ${"x".repeat(200)} ` });
      expect(result[field]).toBe("x".repeat(200));
    });
  });

  it.each(["APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"])(
    "accepts status %s",
    (status) => {
      expect(applicationInputSchema.parse({ ...validInput, status }).status).toBe(status);
    },
  );

  it.each(["PENDING", "applied", "", null])("rejects invalid status %j", (status) => {
    expect(applicationInputSchema.safeParse({ ...validInput, status }).success).toBe(false);
  });

  it.each(["http://example.com/jobs/123", "https://example.com/jobs/123"])(
    "accepts HTTP/HTTPS URL %s",
    (jobUrl) => {
      expect(applicationInputSchema.parse({ ...validInput, jobUrl }).jobUrl).toBe(jobUrl);
    },
  );

  it.each(["not a url", "/jobs/123", "", "https://", "ftp://example.com/jobs", "mailto:jobs@example.com", "javascript:alert(1)"])(
    "rejects invalid or non-HTTP URL %s",
    (jobUrl) => {
      expect(applicationInputSchema.safeParse({ ...validInput, jobUrl }).success).toBe(false);
    },
  );

  it.each([undefined, null, "2026-10-07", new Date("invalid")])(
    "rejects missing or invalid appliedDate %j",
    (appliedDate) => {
      expect(applicationInputSchema.safeParse({ ...validInput, appliedDate }).success).toBe(false);
    },
  );
});

describe("applicationSchema", () => {
  const record: Application = {
    ...validInput,
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "APPLIED",
    createdAt: new Date("2026-10-07T12:00:00Z"),
    updatedAt: new Date("2026-10-07T13:00:00Z"),
  };

  it("accepts a complete application record", () => {
    expect(applicationSchema.parse(record)).toEqual(record);
  });

  it.each([undefined, "not-a-uuid"])("rejects missing or invalid UUID %j", (id) => {
    expect(applicationSchema.safeParse({ ...record, id }).success).toBe(false);
  });

  it.each(["createdAt", "updatedAt"] as const)("requires a valid %s timestamp", (field) => {
    for (const value of [undefined, null, "2026-10-07T12:00:00Z", new Date("invalid")]) {
      expect(applicationSchema.safeParse({ ...record, [field]: value }).success).toBe(false);
    }
  });
});
