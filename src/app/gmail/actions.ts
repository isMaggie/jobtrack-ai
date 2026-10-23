"use server";
import { revalidatePath } from "next/cache";
import { requireAppAccess } from "@/lib/access";
import { getPool } from "@/lib/db";
import { syncGmail } from "@/lib/gmail";

export async function syncGmailAction(): Promise<string> {
  await requireAppAccess();
  try {
    const count = await syncGmail();
    revalidatePath("/applications/import");
    return `Sync complete: ${count} new emails analyzed. Review drafts before saving.`;
  } catch {
    return "Sync failed. Previously analyzed drafts are available. Try again or reconnect Gmail.";
  }
}
export async function disconnectGmailAction() {
  await requireAppAccess();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(724019)");
    await client.query("DELETE FROM gmail_connection");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  revalidatePath("/applications/import");
}
