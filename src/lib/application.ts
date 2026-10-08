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
  jobDescription: z.string().optional(),
  jobUrl: z.url({ protocol: /^https?$/ }).optional(),
  status: applicationStatusSchema.default("APPLIED"),
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
