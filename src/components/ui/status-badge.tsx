import type { ApplicationStatus } from "@/lib/application";

export const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Applied", INTERVIEW: "Interview", OFFER: "Offer", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
};
const statusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "bg-blue-50 text-blue-800 ring-blue-200",
  INTERVIEW: "bg-violet-50 text-violet-800 ring-violet-200",
  OFFER: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  WITHDRAWN: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}
