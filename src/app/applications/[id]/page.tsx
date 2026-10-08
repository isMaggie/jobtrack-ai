import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StatusForm } from "@/components/applications/status-form";
import { applicationSchema } from "@/lib/application";
import { getApplicationById } from "@/lib/application-repository";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!applicationSchema.shape.id.safeParse(id).success) notFound();
  const application = await getApplicationById(id);
  if (!application) notFound();
  const appliedDate = application.appliedDate.toISOString().slice(0, 10);
  return <main className="mx-auto max-w-3xl p-6">
    <Link className="text-blue-700 underline" href="/">Back to dashboard</Link>
    <h1 className="mt-6 text-3xl font-semibold">{application.position}</h1>
    <p className="mt-2 text-xl">{application.company}</p>
    <dl className="mt-6 space-y-3">
      <div><dt className="font-medium">Status</dt><dd>{application.status}</dd></div>
      <div><dt className="font-medium">Applied date</dt><dd><time dateTime={appliedDate}>{appliedDate}</time></dd></div>
      <div><dt className="font-medium">Job URL</dt><dd>{application.jobUrl ? <a className="break-all text-blue-700 underline" href={application.jobUrl}>{application.jobUrl}</a> : "Not provided"}</dd></div>
      <div><dt className="font-medium">Job description</dt><dd className="whitespace-pre-wrap break-words">{application.jobDescription || "Not provided"}</dd></div>
    </dl>
    <StatusForm id={application.id} status={application.status} />
  </main>;
}
