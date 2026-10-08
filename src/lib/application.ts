import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

// Input contains only user-entered fields; identity and timestamps belong to a record.
export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(200),
  position: z.string().trim().min(1, "Position is required").max(200),
  jobDescription: z.string().max(20_000).optional(),
  jobUrl: z.url({ protocol: /^https?$/ }).max(2_048).optional(),
  status: applicationStatusSchema.default("APPLIED"),
  // Persistence uses the UTC calendar day and returns midnight UTC.
  appliedDate: z.date(),
});

// Dates are valid Date objects, without implicit conversion or generated values.
export const applicationSchema = applicationInputSchema.extend({
  id: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationInput = z.input<typeof applicationInputSchema>;
export type Application = z.infer<typeof applicationSchema>;
