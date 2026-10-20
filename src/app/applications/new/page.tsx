import Link from "next/link";
import { ApplicationForm } from "@/components/applications/application-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default function NewApplicationPage() {
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-6"><Link className="text-link text-sm" href="/">Back to dashboard</Link></div>
    <PageHeader title="Create application" description="Save the details of a job you applied for." />
    <p className="mb-6 text-sm text-slate-600">Have a confirmation email? <Link href="/applications/import" className="text-link">Import an application draft</Link></p>
    <Panel><ApplicationForm /></Panel>
  </main>;
}
