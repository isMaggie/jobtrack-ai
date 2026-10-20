import Link from "next/link";
import { EmailImportForm } from "@/components/applications/email-import-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default function ImportApplicationPage() {
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-6"><Link className="text-link text-sm" href="/">Back to dashboard</Link></div>
    <PageHeader title="Import from email" description="Review a proposed application or status update from a pasted email." />

    <Panel><EmailImportForm /></Panel>
  </main>;
}
