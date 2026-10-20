"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormField } from "@/components/ui/form-field";
import { FormFeedback } from "@/components/ui/form-feedback";
import { createApplicationAction } from "@/app/applications/actions";
import { type ApplicationFormField, type ApplicationFormValues, type ApplicationFormState } from "@/lib/application-form";

const fields: { name: ApplicationFormField; label: string; type?: string; required?: boolean; maxLength?: number }[] = [
  { name: "company", label: "Company", required: true, maxLength: 200 },
  { name: "position", label: "Position", required: true, maxLength: 200 },
  { name: "appliedDate", label: "Applied date", type: "date", required: true },
  { name: "jobUrl", label: "Job URL", type: "url", maxLength: 2_048 },
  { name: "jobDescription", label: "Job description", maxLength: 20_000 },
];
const initialState: ApplicationFormState = {};

export function ApplicationForm({ initialValues, submitLabel = "Create application", cancelLabel = "Cancel" }: { initialValues?: ApplicationFormValues; submitLabel?: string; cancelLabel?: string }) {
  const [state, action, pending] = useActionState(createApplicationAction, { ...initialState, values: initialValues });
  return <form action={action} className="space-y-6">
    <p className="text-sm text-slate-600">Company, position, and applied date are required. New applications start as Applied.</p>
    <div className="grid gap-6 sm:grid-cols-2">
    {fields.map((field) => {
      const errors = state.fieldErrors?.[field.name];
      const props = {
        id: field.name, name: field.name, required: field.required, maxLength: field.maxLength,
        defaultValue: state.values?.[field.name] ?? initialValues?.[field.name] ?? "",
        "aria-invalid": !!errors?.length,
        "aria-describedby": errors?.length ? `${field.name}-error` : undefined,
        className: "form-control",
      };
      return <div key={field.name} className={field.name === "jobDescription" ? "sm:col-span-2" : ""}>
        <FormField id={field.name} label={field.label} optional={!field.required} errors={errors}>
        {field.name === "jobDescription" ? <textarea {...props} rows={8} /> : <input {...props} type={field.type ?? "text"} />}
        </FormField>
      </div>;
    })}
    </div>
    <FormFeedback message={state.message} error={!!state.message} />
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
    <button type="submit" disabled={pending} className="button-primary">{pending ? "Saving…" : submitLabel}</button>
      <Link className="button-secondary" href="/">{cancelLabel}</Link>
    </div>
  </form>;
}
