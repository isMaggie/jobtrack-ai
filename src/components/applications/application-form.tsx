"use client";

import { useActionState } from "react";
import { createApplicationAction } from "@/app/applications/actions";
import { type ApplicationFormField, type ApplicationFormValues, type ApplicationFormState } from "@/lib/application-form";

const fields: { name: ApplicationFormField; label: string; type?: string; required?: boolean; maxLength?: number }[] = [
  { name: "company", label: "Company", required: true, maxLength: 200 },
  { name: "position", label: "Position", required: true, maxLength: 200 },
  { name: "appliedDate", label: "Applied date", type: "date", required: true },
  { name: "jobUrl", label: "Job URL (optional)", type: "url", maxLength: 2_048 },
  { name: "jobDescription", label: "Job description (optional)", maxLength: 20_000 },
];
const initialState: ApplicationFormState = {};

export function ApplicationForm({ initialValues, submitLabel = "Create application" }: { initialValues?: ApplicationFormValues; submitLabel?: string }) {
  const [state, action, pending] = useActionState(createApplicationAction, { ...initialState, values: initialValues });
  return <form action={action} className="space-y-5">
    {fields.map((field) => {
      const errors = state.fieldErrors?.[field.name];
      const props = {
        id: field.name, name: field.name, required: field.required, maxLength: field.maxLength,
        defaultValue: state.values?.[field.name] ?? initialValues?.[field.name] ?? "",
        "aria-invalid": !!errors?.length,
        "aria-describedby": errors?.length ? `${field.name}-error` : undefined,
        className: "mt-1 block w-full rounded border border-gray-400 p-2",
      };
      return <div key={field.name}>
        <label htmlFor={field.name} className="font-medium">{field.label}</label>
        {field.name === "jobDescription" ? <textarea {...props} rows={8} /> : <input {...props} type={field.type ?? "text"} />}
        {errors?.length ? <p id={`${field.name}-error`} className="mt-1 text-red-700">{errors.join(" ")}</p> : null}
      </div>;
    })}
    <p aria-live="polite">{state.message}</p>
    <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving…" : submitLabel}</button>
  </form>;
}
