import { z } from "zod";
import { calendarDateSchema } from "./calendar-date";
import { applicationInputSchema } from "./application";

export const applicationFormFields = ["company", "position", "appliedDate", "jobUrl", "jobDescription"] as const;
export type ApplicationFormField = typeof applicationFormFields[number];
export type ApplicationFormValues = Record<ApplicationFormField, string>;
export type ApplicationFormState = {
  values?: ApplicationFormValues;
  fieldErrors?: Partial<Record<ApplicationFormField, string[]>>;
  message?: string;
};
export type StatusFormState = { message?: string; error?: string };

// HTML forms supply strings, while the domain schema requires a Date object.
const formSchema = applicationInputSchema.omit({ status: true }).extend({ appliedDate: calendarDateSchema.transform((value) => new Date(`${value}T00:00:00.000Z`)) });

export function parseApplicationForm(formData: FormData) {
  const raw = Object.fromEntries(applicationFormFields.map((field) => [field, formData.get(field)]));
  const values = Object.fromEntries(applicationFormFields.map((field) => [field, typeof raw[field] === "string" ? raw[field] : ""])) as ApplicationFormValues;
  const result = formSchema.safeParse({
    ...raw,
    jobUrl: typeof raw.jobUrl === "string" ? raw.jobUrl.trim() || undefined : raw.jobUrl === null ? undefined : raw.jobUrl,
    jobDescription: typeof raw.jobDescription === "string" ? raw.jobDescription.trim() ? raw.jobDescription : undefined : raw.jobDescription === null ? undefined : raw.jobDescription,
  });
  if (!result.success) {
    return { success: false as const, values, fieldErrors: z.flattenError(result.error).fieldErrors };
  }
  // Ignore any submitted status: creation always uses the domain's APPLIED default.
  return { success: true as const, values, data: applicationInputSchema.parse(result.data) };
}
