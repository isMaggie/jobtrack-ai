import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StatusForm } from "@/components/applications/status-form";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { applicationSchema } from "@/lib/application";
import { getApplicationById } from "@/lib/application-repository";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!applicationSchema.shape.id.safeParse(id).success) notFound();
  const application = await getApplicationById(id);
  if (!application) notFound();
  const appliedDate = application.appliedDate.toISOString().slice(0, 10);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <Link className="text-link text-sm" href="/">Back to dashboard</Link>
    <div className="my-8">
      <div className="flex flex-wrap items-center gap-4"><h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight">{application.position}</h1><StatusBadge status={application.status} /></div>
      <p className="mt-2 break-words text-xl text-slate-600">{application.company}</p>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Panel>
          <h2 className="mb-4 text-lg font-semibold">Application overview</h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm font-medium text-slate-500">Applied date</dt><dd className="mt-1"><time dateTime={appliedDate}>{appliedDate}</time></dd></div>
            <div><dt className="text-sm font-medium text-slate-500">Job posting</dt><dd className="mt-1">{application.jobUrl ? <a className="text-link" href={application.jobUrl}>View job posting</a> : <span className="text-slate-500">Not provided</span>}</dd></div>
          </dl>
        </Panel>
        <section aria-labelledby="description-heading"><Panel>
          <h2 id="description-heading" className="mb-4 text-lg font-semibold">Job description</h2>
          <p className="whitespace-pre-wrap break-words leading-7 text-slate-700">{application.jobDescription || "No job description provided."}</p>
        </Panel></section>
      </div>
      <aside className="lg:col-start-2" aria-labelledby="progress-heading"><Panel>
        <h2 id="progress-heading" className="text-lg font-semibold">Application progress</h2>
        <p className="mt-2 text-sm text-slate-600">Update your status as your application moves forward.</p>
        <StatusForm id={application.id} status={application.status} />
      </Panel></aside>
    </div>
  </main>;
}
