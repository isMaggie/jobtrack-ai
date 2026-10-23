import { connection as requestConnection } from "next/server";
import { getPool } from "@/lib/db";
import { classifiedDraftSchema, draftToFormValues } from "@/lib/application-draft";
import { matchingApplications } from "@/lib/email-import";
import { listApplications } from "@/lib/application-repository";
import { GmailControls } from "@/components/applications/gmail-controls";
import Link from "next/link";
import { EmailImportForm } from "@/components/applications/email-import-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default async function ImportApplicationPage({ searchParams }: { searchParams: Promise<{ gmail?: string; gmailMessage?: string }> }) {
  await requestConnection();
  const params = await searchParams;
  const connection = (await getPool().query("SELECT email FROM gmail_connection WHERE id=1")).rows[0];
  const imports = connection ? (await getPool().query("SELECT message_id,draft FROM gmail_imports WHERE email=$1 ORDER BY created_at DESC LIMIT 20", [connection.email])).rows : [];
  const applications = imports.length ? await listApplications() : [];
  const notice = params.gmail;
  const selected = imports.some((item) => item.message_id === params.gmailMessage && classifiedDraftSchema.safeParse(item.draft).success && item.draft?.emailType !== "OTHER");

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="mb-6"><Link className="text-link text-sm" href="/">Back to dashboard</Link></div>
    <PageHeader title="Import from email" description="Review a proposed application or status update from a pasted email." />

    <Panel>
      <h2 className="text-xl font-semibold">Gmail</h2>
      <p className="my-3 text-sm">Manual sync checks up to 20 recent candidate emails and analyzes up to 5 unseen messages from the last 14 days. Email text is sent to OpenAI for analysis and is not stored. Only extracted drafts are retained. Review and explicitly confirm every application change.</p>
      {notice && <p role="status">{notice === "connected" ? "Gmail connected." : "Couldn’t connect Gmail. Try again."}</p>}
      <GmailControls email={connection?.email} />
      {imports.map((item) => {
        const parsed = classifiedDraftSchema.safeParse(item.draft);
        if (!parsed.success || parsed.data.emailType === "OTHER") return null;
        const draft = parsed.data;
        const matches = matchingApplications(applications, draft.company ?? "", draft.position ?? "").map((app) => ({ ...app, appliedDate: app.appliedDate.toISOString().slice(0, 10) }));
        if (params.gmailMessage !== item.message_id) return <p key={item.message_id} className="my-3"><Link className="text-link" href={`/applications/import?gmailMessage=${encodeURIComponent(item.message_id)}`}>Review Gmail draft: {draft.company || "Unknown company"} — {draft.position || "Unknown position"} ({draft.emailType})</Link></p>;
        return <details open key={item.message_id} className="my-4 border-t pt-3"><summary>Review Gmail draft: {draft.company || "Unknown company"} — {draft.position || "Unknown position"} ({draft.emailType})</summary>
          <EmailImportForm initialState={{ values: draftToFormValues(draft), emailType: draft.emailType, matches, message: `Review every field. No application changes have been saved.${matches.length ? " An application already matches this company and position. Confirm only if you intend another application or a status update." : ""}` }} />
        </details>;
      })}
    </Panel>
    {!selected && <Panel><EmailImportForm /></Panel>}
  </main>;
}
