"use server";

import { requireAppAccess } from "../../../lib/access";
import { revalidatePath } from "next/cache";
import { applicationSchema, applicationStatusSchema } from "../../../lib/application";
import { classifiedDraftSchema, draftReviewMessage, draftToFormValues, emailInputSchema, type EmailImportState } from "../../../lib/application-draft";
import { extractApplicationDraft } from "../../../lib/email-extraction";
import { confirmImportedStatus, getApplicationById, listApplications } from "../../../lib/application-repository";
import { matchingApplications, matchInputSchema, proposedStatus } from "../../../lib/email-import";

async function findMatches(company: string, position: string) {
  return matchingApplications(await listApplications(), company, position).map((application) => ({
    id: application.id, company: application.company, position: application.position,
    status: application.status, appliedDate: application.appliedDate.toISOString().slice(0, 10),
  }));
}

async function reviewDraft(draft: import("zod").infer<typeof classifiedDraftSchema>): Promise<EmailImportState> {
    if (draft.emailType === "OTHER") return { emailType: "OTHER", message: "No single supported application event was identified. Nothing has been saved." };
    const matches = await findMatches(draft.company ?? "", draft.position ?? "");
    return { emailType: draft.emailType, values: draftToFormValues(draft), matches,
      message: draft.emailType === "APPLICATION_CONFIRMATION" ? `${draftReviewMessage(draft)}${matches.length ? " An application with this company and position already exists. Confirm only if you want another application." : ""}` : "Review the matching application and proposed status. Nothing has been saved." };
}

// Analysis and matching are read-only. Only confirmation actions may write.
export async function extractEmailAction(formData: FormData): Promise<EmailImportState> {
  await requireAppAccess();
  const input = emailInputSchema.safeParse({ emailText: formData.get("emailText") });
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const draft = classifiedDraftSchema.parse(await extractApplicationDraft(input.data.emailText));
    return reviewDraft(draft);
  } catch (error) {
    console.error("Email analysis or application lookup failed");
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return { error: "Email extraction is not configured. You can create an application manually." };
    }
    return { error: "Couldn’t analyze the email or find matching applications. Try again or create an application manually." };
  }
}

export async function matchEmailAction(formData: FormData): Promise<EmailImportState> {
  await requireAppAccess();
  const input = matchInputSchema.safeParse(Object.fromEntries(["company", "position", "emailType"].map((key) => [key, formData.get(key)])));
  if (!input.success || !proposedStatus(input.data.emailType)) return { error: "Enter a company and position for a supported status email." };
  try {
    return { matches: await findMatches(input.data.company, input.data.position), message: "Matches refreshed. Nothing has been saved." };
  } catch {
    console.error("Email application matching failed");
    return { error: "Couldn’t find applications. Try again." };
  }
}

export async function confirmEmailStatusAction(formData: FormData): Promise<{ error?: string; message?: string }> {
  await requireAppAccess();
  const input = matchInputSchema.safeParse(Object.fromEntries(["company", "position", "emailType"].map((key) => [key, formData.get(key)])));
  const id = applicationSchema.shape.id.safeParse(formData.get("id"));
  const expected = applicationStatusSchema.safeParse(formData.get("expectedStatus"));
  if (!input.success || !id.success || !expected.success || formData.get("confirm") !== "yes") return { error: "Review and explicitly confirm a valid application." };
  const status = proposedStatus(input.data.emailType);
  if (!status) return { error: "This email does not propose a status update." };
  try {
    const application = await getApplicationById(id.data);
    if (!application || !matchingApplications([application], input.data.company, input.data.position).length || application.status !== expected.data) {
      return { error: "The application changed or no longer matches. Find matches again and review before confirming." };
    }
    if (application.status === status) return { message: "Already up to date. Nothing was changed." };
    if (!await confirmImportedStatus(id.data, status, expected.data, application)) return { error: "The application changed. Find matches again and review before confirming." };
    revalidatePath("/");
    revalidatePath(`/applications/${id.data}`);
    return { message: "Status updated." };
  } catch {
    console.error("Email status confirmation failed");
    return { error: "Couldn’t update the status. Try again." };
  }
}
