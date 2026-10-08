"use server";

import { applicationDraftSchema, draftReviewMessage, draftToFormValues, emailInputSchema, type EmailImportState } from "../../../lib/application-draft";
import { extractApplicationDraft } from "../../../lib/email-extraction";

// Extraction has no repository dependency and never persists the email or draft.
export async function extractEmailAction(formData: FormData): Promise<EmailImportState> {
  const input = emailInputSchema.safeParse({ emailText: formData.get("emailText") });
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    const draft = applicationDraftSchema.parse(await extractApplicationDraft(input.data.emailText));
    return { values: draftToFormValues(draft), message: draftReviewMessage(draft) };
  } catch (error) {
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return { error: "Email extraction is not configured. You can create an application manually." };
    }
    return { error: "Couldn’t extract a valid draft. Try again or create an application manually." };
  }
}
