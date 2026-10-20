import { z } from "zod";
import { applicationInputSchema, type Application } from "./application";

export const emailTypeSchema = z.enum(["APPLICATION_CONFIRMATION", "INTERVIEW", "OFFER", "REJECTION", "OTHER"]);
export type EmailType = z.infer<typeof emailTypeSchema>;
export const matchInputSchema = z.strictObject({
  company: applicationInputSchema.shape.company,
  position: applicationInputSchema.shape.position,
  emailType: emailTypeSchema,
});
export function proposedStatus(type: EmailType) {
  switch (type) {
    case "INTERVIEW": return "INTERVIEW";
    case "OFFER": return "OFFER";
    case "REJECTION": return "REJECTED";
    default: return null;
  }
}
export function normalizeMatch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
export function matchingApplications(applications: Application[], company: string, position: string) {
  if (!company.trim() || !position.trim()) return [];
  return applications.filter((application) => normalizeMatch(application.company) === normalizeMatch(company)
    && normalizeMatch(application.position) === normalizeMatch(position));
}
export type ImportMatch = Pick<Application, "id" | "company" | "position" | "status"> & { appliedDate: string };
