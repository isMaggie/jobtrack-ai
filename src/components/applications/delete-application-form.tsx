"use client";

import { useActionState } from "react";
import { deleteApplicationAction } from "@/app/applications/actions";
import { FormFeedback } from "@/components/ui/form-feedback";
import { type DeleteApplicationFormState } from "@/lib/application-form";

const initialState: DeleteApplicationFormState = {};

export function DeleteApplicationForm({ id, company, position }: { id: string; company: string; position: string }) {
  const [state, action, pending] = useActionState(deleteApplicationAction.bind(null, id), initialState);
  return <form action={action} className="mt-4 space-y-4">
    <p className="break-words text-sm text-slate-600">Permanently delete {position} at {company}. This cannot be undone. Gmail import history will be preserved.</p>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="confirm" value="yes" required disabled={pending} className="mt-1" />
      <span>I confirm I want to delete this application.</span>
    </label>
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50">{pending ? "Deleting…" : "Delete application"}</button>
    <FormFeedback message={state.error} error={!!state.error} />
  </form>;
}
