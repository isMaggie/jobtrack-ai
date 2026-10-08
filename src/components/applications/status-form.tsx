"use client";

import { useActionState } from "react";
import { updateApplicationStatusAction } from "@/app/applications/actions";
import { applicationStatusSchema, type ApplicationStatus } from "@/lib/application";
import { type StatusFormState } from "@/lib/application-form";

const initialState: StatusFormState = {};

export function StatusForm({ id, status }: { id: string; status: ApplicationStatus }) {
  const [state, action, pending] = useActionState(updateApplicationStatusAction.bind(null, id), initialState);
  return <form action={action} className="mt-6 space-y-3">
    <label htmlFor="status" className="block font-medium">Update status</label>
    <select key={status} id="status" name="status" defaultValue={status} aria-invalid={!!state.error} aria-describedby="status-message" className="rounded border border-gray-400 p-2">
      {applicationStatusSchema.options.map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
    <button type="submit" disabled={pending} className="ml-3 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{pending ? "Updating…" : "Save status"}</button>
    <p id="status-message" aria-live="polite" className={state.error ? "text-red-700" : ""}>{state.error ?? state.message}</p>
  </form>;
}
