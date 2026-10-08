import { z } from "zod";
import { applicationInputSchema } from "./application";
import { calendarDateSchema } from "./calendar-date";
import { applicationFormFields, type ApplicationFormValues } from "./application-form";

export const MAX_EMAIL_LENGTH = 20_000;
export const emailInputSchema = z.strictObject({
  emailText: z.string().max(MAX_EMAIL_LENGTH, "Email must be 20,000 characters or fewer").trim().min(1, "Paste a confirmation email"),
});

export const applicationDraftSchema = z.strictObject({
  company: applicationInputSchema.shape.company.nullable(),
  position: applicationInputSchema.shape.position.nullable(),
  appliedDate: calendarDateSchema.nullable(),
  jobUrl: applicationInputSchema.shape.jobUrl.unwrap().nullable(),
  jobDescription: applicationInputSchema.shape.jobDescription.unwrap().nullable(),
});
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
export type EmailImportState = { values?: ApplicationFormValues; message?: string; error?: string };

export function draftToFormValues(draft: ApplicationDraft): ApplicationFormValues {
  return Object.fromEntries(applicationFormFields.map((field) => [field, draft[field] ?? ""])) as ApplicationFormValues;
}

export function draftReviewMessage(draft: ApplicationDraft): string {
  const missing = [!draft.company && "company", !draft.position && "position", !draft.appliedDate && "applied date"].filter(Boolean);
  return missing.length ? `Review every field and supply the missing ${missing.join(", ")}. Nothing has been saved.` : "Review every field before confirming. Nothing has been saved.";
}
