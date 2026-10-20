import Link from "next/link";
import { connection } from "next/server";
import { listApplications } from "@/lib/application-repository";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function Home() {
  await connection();
  const applications = await listApplications();
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <PageHeader title="Applications" description="Keep your job search organized, one application at a time." actions={<>
      <Link className="button-secondary" href="/applications/import">Import from email</Link>
      <Link className="button-primary" href="/applications/new">Create application</Link>
    </>} />
    {applications.length === 0 ? <Panel>
      <div className="py-8 text-center">
        <h2 className="text-xl font-semibold">Your next opportunity starts here</h2>
        <p className="mx-auto mt-2 max-w-md text-slate-600">Add your first application to keep its details and progress in one place.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="button-primary" href="/applications/new">Create application</Link>
          <Link className="button-secondary" href="/applications/import">Import from email</Link>
        </div>
      </div>
    </Panel> : <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Your job applications, newest first</caption>
          <thead className="bg-slate-50 text-slate-600"><tr>{["Company", "Position", "Status", "Applied date", "Details"].map((heading) => <th key={heading} scope="col" className="border-b border-slate-200 px-5 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{applications.map((application) => <tr key={application.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <td className="break-words px-5 py-5 font-semibold">{application.company}</td>
            <td className="break-words px-5 py-5">{application.position}</td>
            <td className="px-5 py-5"><StatusBadge status={application.status} /></td>
            <td className="whitespace-nowrap px-5 py-5 text-slate-600"><time dateTime={application.appliedDate.toISOString().slice(0, 10)}>{application.appliedDate.toISOString().slice(0, 10)}</time></td>
            <td className="px-5 py-5"><Link className="text-link inline-flex min-h-11 items-center" href={`/applications/${application.id}`} aria-label={`View ${application.position} at ${application.company}`}>View details</Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="space-y-4 md:hidden" aria-label="Your job applications, newest first">
        {applications.map((application) => <li key={application.id}><Panel>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-words font-semibold">{application.company}</p><StatusBadge status={application.status} /></div>
          <h2 className="mt-2 break-words text-lg font-medium">{application.position}</h2>
          <p className="mt-3 text-sm text-slate-600">Applied <time dateTime={application.appliedDate.toISOString().slice(0, 10)}>{application.appliedDate.toISOString().slice(0, 10)}</time></p>
          <Link className="text-link mt-3 inline-flex min-h-11 items-center text-sm" href={`/applications/${application.id}`} aria-label={`View ${application.position} at ${application.company}`}>View details</Link>
        </Panel></li>)}
      </ul>
    </>}
  </main>;
}
