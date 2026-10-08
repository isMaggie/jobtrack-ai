"use client";

import Link from "next/link";
import { useState } from "react";
import { extractEmailAction } from "@/app/applications/import/actions";
import { MAX_EMAIL_LENGTH, type EmailImportState } from "@/lib/application-draft";
import { ApplicationForm } from "./application-form";

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

  if (state.values) return <section className="space-y-5">
    <h2 className="text-2xl font-semibold">Review application draft</h2>
    <p role="status">{state.message}</p>
    <p>Missing or ambiguous facts are left blank. New applications start with APPLIED status.</p>
    <ApplicationForm initialValues={state.values} submitLabel="Confirm and save application" />
    <button type="button" onClick={() => setState({})} className="text-blue-700 underline">Back to pasted email</button>
    <p><Link href="/" className="text-blue-700 underline">Cancel and discard draft</Link></p>
  </section>;

  return <form action={extract} className="space-y-5">
    <p id="email-help">Extract draft sends this text to OpenAI. Remove personal information you do not want to share. The email is not stored by JobTrack. Review and explicitly confirm before anything is saved.</p>
    <div>
      <label htmlFor="emailText" className="font-medium">Confirmation email (plain text)</label>
      <textarea id="emailText" name="emailText" rows={12} required maxLength={MAX_EMAIL_LENGTH}
        value={emailText} onChange={(event) => setEmailText(event.target.value)} disabled={pending}
        aria-describedby="email-help email-error" aria-invalid={!!state.error}
        className="mt-1 block w-full rounded border border-gray-400 p-2" />
    </div>
    <p id="email-error" role="alert" className="text-red-700">{state.error}</p>
    <p aria-live="polite">{pending ? "Extracting draft…" : ""}</p>
    <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{pending ? "Extracting…" : "Extract draft"}</button>
    <p><Link href="/applications/new" className="text-blue-700 underline">Create manually instead</Link></p>
  </form>;
}
