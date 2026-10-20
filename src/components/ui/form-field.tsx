import type { ReactNode } from "react";

export function FormField({ id, label, optional, hint, errors, children }: { id: string; label: string; optional?: boolean; hint?: string; errors?: string[]; children: ReactNode }) {
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold">{label}{optional && <span className="ml-2 font-normal text-slate-500">Optional</span>}</label>
    {hint && <p id={`${id}-hint`} className="text-sm text-slate-600">{hint}</p>}
    {children}
    {errors?.length ? <p id={`${id}-error`} className="text-sm text-red-700">{errors.join(" ")}</p> : null}
  </div>;
}
