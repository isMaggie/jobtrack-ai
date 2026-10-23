"use client";
import { useState } from "react";
import { syncGmailAction, disconnectGmailAction } from "@/app/gmail/actions";

export function GmailControls({ email }: { email?: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  if (!email) return <form action="/gmail/connect" method="post"><button className="button-secondary">Connect Gmail</button></form>;
  return <div className="space-y-3">
    <p>Connected: {email}</p>
    <form action={async () => {
      setPending(true);
      try { setMessage(await syncGmailAction()); }
      catch { setMessage("Couldn’t sync Gmail. Try again."); }
      finally { setPending(false); }
    }}><button disabled={pending} className="button-primary">{pending ? "Syncing…" : "Sync Gmail"}</button></form>
    <form action={disconnectGmailAction}><button disabled={pending} className="text-link">Disconnect Gmail</button></form>
    <p role="status">{message}</p>
  </div>;
}
