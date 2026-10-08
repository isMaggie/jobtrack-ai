"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applicationSchema, applicationStatusSchema } from "../../lib/application";
import { parseApplicationForm, type ApplicationFormState, type StatusFormState } from "../../lib/application-form";
import { createApplication, updateApplicationStatus } from "../../lib/application-repository";

export async function createApplicationAction(_previousState: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
  const parsed = parseApplicationForm(formData);
  if (!parsed.success) return { values: parsed.values, fieldErrors: parsed.fieldErrors, message: "Please correct the highlighted fields." };

  let application;
  try {
    application = await createApplication(parsed.data);
  } catch {
    console.error("Application creation failed");
    return { values: parsed.values, message: "Couldn’t save the application. Please try again." };
  }
  revalidatePath("/");
  redirect(`/applications/${application.id}`);
}

export async function updateApplicationStatusAction(id: string, _previousState: StatusFormState, formData: FormData): Promise<StatusFormState> {
  const validId = applicationSchema.shape.id.safeParse(id);
  const status = applicationStatusSchema.safeParse(formData.get("status"));
  if (!validId.success) return { error: "Invalid application ID." };
  if (!status.success) return { error: "Choose a valid application status." };

  try {
    const application = await updateApplicationStatus(validId.data, status.data);
    if (!application) return { error: "This application no longer exists." };
  } catch {
    console.error("Application status update failed");
    return { error: "Couldn’t update the status. Please try again." };
  }
  revalidatePath("/");
  revalidatePath(`/applications/${validId.data}`);
  return { message: "Status updated." };
}
