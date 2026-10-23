import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPool } from "./db";
import { classifiedDraftSchema, MAX_EMAIL_LENGTH } from "./application-draft";
import { extractApplicationDraft } from "./email-extraction";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export function gmailConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Gmail is not configured");
  return { clientId, clientSecret, redirectUri };
}
function key() {
  const value = Buffer.from(process.env.GMAIL_TOKEN_KEY ?? "", "base64");
  if (value.length !== 32) throw new Error("GMAIL_TOKEN_KEY must contain 32 random bytes in base64");
  return value;
}
export function encryptTokens(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
export function decryptTokens(value: string) {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), expires_in: z.number().positive(), scope: z.string().optional() });
async function jsonRequest(url: string, init?: RequestInit) {
  // Test runner pins both databases and fake providers; never redirect production traffic.
  if (process.env.GMAIL_TEST_ORIGIN) {
    if (process.env.NODE_ENV === "production" || !process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || process.env.GMAIL_TEST_ORIGIN !== "http://127.0.0.1:3101") throw new Error("Invalid Gmail test configuration");
    url = `${process.env.GMAIL_TEST_ORIGIN}${new URL(url).pathname}${new URL(url).search}`;
  }
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Gmail request failed; reconnect if access expired");
  return response.json();
}
export async function exchangeToken(params: Record<string, string>) {
  const config = gmailConfig();
  return tokenSchema.parse(await jsonRequest("https://oauth2.googleapis.com/token", {
    method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  }));
}
async function gmail(path: string, access: string) {
  return jsonRequest(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${access}` } });
}
export type GmailConnectionStage = "token_exchange" | "permission_check" | "profile_lookup" | "database_connect" | "database_transaction" | "token_encryption" | "connection_save" | "database_commit";
export function reportGmailCallbackFailure(stage: "callback_validation" | GmailConnectionStage) {
  // Only allowlisted stage names: never include errors, request URLs, or provider data.
  if (process.env.NODE_ENV === "development") console.error("Gmail callback failed", { stage });
}
export async function connectGmail(code: string, verifier: string, onStage?: (stage: GmailConnectionStage) => void) {
  onStage?.("token_exchange");
  const tokens = await exchangeToken({ code, code_verifier: verifier, redirect_uri: gmailConfig().redirectUri, grant_type: "authorization_code" });
  onStage?.("permission_check");
  if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(GMAIL_SCOPE)) throw new Error("Gmail permission missing");
  onStage?.("profile_lookup");
  const profile = z.object({ emailAddress: z.email() }).parse(await gmail("profile", tokens.access_token));
  onStage?.("database_connect");
  const client = await getPool().connect();
  try {
    onStage?.("database_transaction");
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(724019)");
    onStage?.("token_encryption");
    const encrypted = encryptTokens(JSON.stringify(tokens));
    onStage?.("connection_save");
    await client.query(`INSERT INTO gmail_connection (id,email,tokens) VALUES (1,$1,$2)
      ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,tokens=EXCLUDED.tokens`, [profile.emailAddress, encrypted]);
    onStage?.("database_commit");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
const partSchema = z.object({ mimeType: z.string().optional(), filename: z.string().optional(), body: z.object({ data: z.string().max(100_000).optional() }).optional(), parts: z.array(z.unknown()).max(100).optional() });
export function messageText(payload: unknown, depth = 0): string {
  if (depth > 10) return "";
  const part = partSchema.parse(payload);
  if (part.filename) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8").slice(0, MAX_EMAIL_LENGTH);
  return (part.parts ?? []).map((child) => messageText(child, depth + 1)).join("\n").slice(0, MAX_EMAIL_LENGTH);
}
export async function syncGmail() {
  const client = await getPool().connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(724019) AS locked")).rows[0].locked;
    if (!locked) throw new Error("A Gmail operation is already running");
    const connection = (await client.query("SELECT email,tokens FROM gmail_connection WHERE id=1")).rows[0];
    if (!connection) throw new Error("Connect Gmail first");
    const stored = JSON.parse(decryptTokens(connection.tokens));
    const tokens = await exchangeToken({ grant_type: "refresh_token", refresh_token: z.string().min(1).parse(stored.refresh_token) });
    await client.query("UPDATE gmail_connection SET tokens=$1 WHERE id=1", [encryptTokens(JSON.stringify({ ...tokens, refresh_token: tokens.refresh_token ?? stored.refresh_token }))]);
    const query = new URLSearchParams({ maxResults: "20", q: 'newer_than:14d -in:spam -in:trash {application interview offer rejection "thank you for applying"}' });
    const list = z.object({ messages: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/) })).max(20).optional() }).parse(await gmail(`messages?${query}`, tokens.access_token));
    let analyzed = 0;
    for (const { id } of list.messages ?? []) {
      if (analyzed >= 5) break;
      if ((await client.query("SELECT 1 FROM gmail_imports WHERE email=$1 AND message_id=$2", [connection.email, id])).rowCount) continue;
      const message = z.object({ payload: z.unknown() }).parse(await gmail(`messages/${id}?format=full`, tokens.access_token));
      const text = messageText(message.payload);
      const draft = text.trim() ? classifiedDraftSchema.parse(await extractApplicationDraft(text)) : null;
      await client.query("INSERT INTO gmail_imports (email,message_id,draft) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [connection.email, id, JSON.stringify(draft)]);
      analyzed++;
    }
    return analyzed;
  } finally {
    try { if (locked) await client.query("SELECT pg_advisory_unlock(724019)"); }
    finally { client.release(); }
  }
}
