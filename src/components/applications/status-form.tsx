"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/ui/form-feedback";
import { statusLabels } from "@/components/ui/status-badge";
import { updateApplicationStatusAction } from "@/app/applications/actions";
import { applicationStatusSchema, type ApplicationStatus } from "@/lib/application";
import { type StatusFormState } from "@/lib/application-form";

const initialState: StatusFormState = {};

export function StatusForm({ id, status }: { id: string; status: ApplicationStatus }) {
  const [state, action, pending] = useActionState(updateApplicationStatusAction.bind(null, id), initialState);
  return <form action={action} className="mt-6 space-y-3">
    <label htmlFor="status" className="block text-sm font-semibold">Update status</label>
    <select key={status} id="status" name="status" defaultValue={status} aria-invalid={!!state.error} aria-describedby="status-message" className="form-control">
      {applicationStatusSchema.options.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
    </select>
    <button type="submit" disabled={pending} className="button-primary w-full">{pending ? "Updating…" : "Save status"}</button>
    <FormFeedback id="status-message" message={state.error ?? state.message} error={!!state.error} />
  </form>;
}
