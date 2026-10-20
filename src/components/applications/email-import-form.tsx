"use client";

import Link from "next/link";
import { useState } from "react";
import { extractEmailAction } from "@/app/applications/import/actions";
import { MAX_EMAIL_LENGTH, type EmailImportState } from "@/lib/application-draft";
import { ApplicationForm } from "./application-form";
import { EmailStatusReview } from "./email-status-review";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormField } from "@/components/ui/form-field";

export function EmailImportForm() {
  const [emailText, setEmailText] = useState("");
  const [state, setState] = useState<EmailImportState>({});
  const [pending, setPending] = useState(false);

  async function extract(formData: FormData) {
    setPending(true);
    setState({});
    try {
      setState(await extractEmailAction(formData));
    } catch {
      setState({ error: "Couldn’t reach the server. Try again or create an application manually." });
    } finally {
      setPending(false);
    }
  }

  const steps = <ol aria-label="Import progress" className="mb-6 grid grid-cols-2 gap-3 border-b border-slate-200 pb-6 text-sm">
    <li aria-current={!state.values ? "step" : undefined} className={!state.values ? "font-semibold text-blue-800" : "text-slate-500"}>1. Paste email</li>
    <li aria-current={state.values ? "step" : undefined} className={state.values ? "font-semibold text-blue-800" : "text-slate-500"}>2. Review and save</li>
  </ol>;

  if (state.emailType === "OTHER") return <section className="space-y-4">
    <FormFeedback message={state.message} />
    <button type="button" className="button-secondary" onClick={() => setState({})}>Back to pasted email</button>
  </section>;
  if (state.values && state.emailType && state.emailType !== "APPLICATION_CONFIRMATION") return <section>
    {steps}
    <EmailStatusReview state={state} onBack={() => setState({})} />
  </section>;

  if (state.values) return <section className="space-y-5">
    {steps}
    <h2 className="text-xl font-semibold">Draft ready for review</h2>
    <FormFeedback message={state.message} />
    <p className="text-sm leading-6 text-slate-600">Review and edit the details before saving. Missing or ambiguous facts are left blank. New applications start as Applied.</p>
    <ApplicationForm initialValues={state.values} submitLabel="Confirm and save application" cancelLabel="Discard draft" />
    <button type="button" onClick={() => setState({})} className="text-link text-sm">Back to pasted email</button>
  </section>;

  return <form action={extract} className="space-y-5">
    {steps}
    <p className="text-sm text-slate-600">Paste the plain text of your application-related email. Analysis proposes an application or status change for you to review.</p>
    <p id="email-help" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">Analyze email sends this text to OpenAI. Remove personal information you do not want to share. The email is not stored by JobTrack. Review and explicitly confirm before anything is saved.</p>
    <FormField id="emailText" label="Email (plain text)">
      <textarea id="emailText" name="emailText" rows={12} required maxLength={MAX_EMAIL_LENGTH}
        value={emailText} onChange={(event) => setEmailText(event.target.value)} disabled={pending}
        aria-describedby="email-help email-error" aria-invalid={!!state.error}
        className="form-control" />
    </FormField>
    <FormFeedback id="email-error" message={state.error} error />
    <FormFeedback message={pending ? "Analyzing email…" : undefined} />
    <button type="submit" disabled={pending} className="button-primary w-full sm:w-auto">{pending ? "Analyzing…" : "Analyze email"}</button>
    <p><Link href="/applications/new" className="text-link text-sm">Create manually instead</Link></p>
  </form>;
}
