import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <h1 className="break-words text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
  </div>;
}
