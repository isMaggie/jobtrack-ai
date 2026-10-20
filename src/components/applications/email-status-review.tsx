"use client";

import Link from "next/link";
import { useState } from "react";
import { confirmEmailStatusAction, matchEmailAction } from "@/app/applications/import/actions";
import type { EmailImportState } from "@/lib/application-draft";
import { proposedStatus } from "@/lib/email-import";
import { FormFeedback } from "@/components/ui/form-feedback";
import { statusLabels } from "@/components/ui/status-badge";

export function EmailStatusReview({ state, onBack }: { state: EmailImportState; onBack: () => void }) {
  const [company, setCompany] = useState(state.values?.company ?? "");
  const [position, setPosition] = useState(state.values?.position ?? "");
  const [matches, setMatches] = useState(state.matches ?? []);
  const [selectedId, setSelectedId] = useState(matches.length === 1 ? matches[0].id : "");
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({ message: state.message });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const selected = matches.find((match) => match.id === selectedId);
  const status = proposedStatus(state.emailType!);
  function fields() {
    const data = new FormData();
    data.set("company", company); data.set("position", position); data.set("emailType", state.emailType!);
    return data;
  }
  function invalidate() { setMatches([]); setSelectedId(""); setSaved(false); setFeedback({ message: "Find matches again after editing. Nothing has been saved." }); }
  async function find() {
    setPending(true); setFeedback({}); setSelectedId(""); setMatches([]); setSaved(false);
    try {
      const result = await matchEmailAction(fields());
      setMatches(result.matches ?? []);
      setSelectedId(result.matches?.length === 1 ? result.matches[0].id : "");
      setFeedback(result);
    } catch { setFeedback({ error: "Couldn’t reach the server. Try again." }); }
    finally { setPending(false); }
  }
  async function confirm() {
    if (!selected) return;
    setPending(true); setFeedback({});
    const data = fields(); data.set("id", selected.id); data.set("expectedStatus", selected.status); data.set("confirm", "yes");
    try {
      const result = await confirmEmailStatusAction(data); setFeedback(result);
      if (result.message) {
        setSaved(true);
        setMatches((current) => current.map((match) => match.id === selected.id && status ? { ...match, status } : match));
      }
      if (result.error) { setMatches([]); setSelectedId(""); }
    } catch { setFeedback({ error: "Couldn’t reach the server. Find matches again before retrying." }); setMatches([]); setSelectedId(""); }
    finally { setPending(false); }
  }
  return <section className="space-y-5">
    <h2 className="text-xl font-semibold">{saved ? "Status update complete" : `Review status update: ${status ? statusLabels[status] : "Unknown"}`}</h2>
    <FormFeedback message={feedback.error ?? feedback.message} error={!!feedback.error} />
    <form action={find} className="space-y-4">
      <label className="block">Company<input className="form-control" name="company" required maxLength={200} value={company} disabled={pending} onChange={(event) => { setCompany(event.target.value); invalidate(); }} /></label>
      <label className="block">Position<input className="form-control" name="position" required maxLength={200} value={position} disabled={pending} onChange={(event) => { setPosition(event.target.value); invalidate(); }} /></label>
      <button className="button-secondary" disabled={pending}>Find matches</button>
    </form>
    {!matches.length && <p>No matching application selected. Check company and position, then find matches.</p>}
    {!!matches.length && <fieldset disabled={pending || saved} className="space-y-3">
      <legend>Choose the application to update</legend>
      {matches.map((match) => <label key={match.id} className="block"><input type="radio" name="application" value={match.id} checked={selectedId === match.id} onChange={() => setSelectedId(match.id)} /> {match.company} — {match.position} · Applied {match.appliedDate} · {statusLabels[match.status]}</label>)}
    </fieldset>}
    {!saved && selected && status && <p>{selected.company} — {selected.position}: {statusLabels[selected.status]} → {statusLabels[status]}</p>}
    {!saved && selected?.status === status && <p>Already up to date. Nothing needs to be saved.</p>}
    {!saved && <button type="button" className="button-primary" disabled={pending || !selected || selected.status === status} onClick={confirm}>{pending ? "Working…" : "Confirm status update"}</button>}
    {saved && selected && <p><Link className="text-link" href={`/applications/${selected.id}`}>View updated application</Link></p>}
    <button type="button" className="button-secondary" disabled={pending} onClick={onBack}>{saved ? "Import another email" : "Discard / back to pasted email"}</button>
  </section>;
}
