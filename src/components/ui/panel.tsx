import type { ReactNode } from "react";

export function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div>;
}
