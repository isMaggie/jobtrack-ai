import Link from "next/link";
import { connection } from "next/server";
import { listApplications } from "@/lib/application-repository";

export default async function Home() {
  await connection();
  const applications = await listApplications();
  return <main className="mx-auto max-w-5xl p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-semibold">Applications</h1>
      <Link className="text-blue-700 underline" href="/applications/import">Import from email</Link>
      <Link className="rounded bg-blue-700 px-4 py-2 text-white" href="/applications/new">Create application</Link>
    </div>
    {applications.length === 0 ? <p>No applications yet. Create your first application to get started.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-left">
        <caption className="sr-only">Your job applications, newest first</caption>
        <thead><tr>{["Company", "Position", "Status", "Applied date", "Details"].map((heading) => <th key={heading} scope="col" className="border-b p-3">{heading}</th>)}</tr></thead>
        <tbody>{applications.map((application) => <tr key={application.id}>
          <td className="border-b p-3">{application.company}</td>
          <td className="border-b p-3">{application.position}</td>
          <td className="border-b p-3">{application.status}</td>
          <td className="whitespace-nowrap border-b p-3"><time dateTime={application.appliedDate.toISOString().slice(0, 10)}>{application.appliedDate.toISOString().slice(0, 10)}</time></td>
          <td className="border-b p-3"><Link className="text-blue-700 underline" href={`/applications/${application.id}`} aria-label={`View ${application.position} at ${application.company}`}>View</Link></td>
        </tr>)}</tbody>
      </table></div>
    )}
  </main>;
}
