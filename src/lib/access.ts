import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

// A single shared password for this personal app; no accounts or sessions.
export function accessStatus(authorization: string | null): 200 | 401 | 503 {
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password?.trim()) return process.env.NODE_ENV === "production" ? 503 : 200;
  const expected = `Basic ${Buffer.from(`jobtrack:${password}`).toString("base64")}`;
  // Fixed-size hashes let us compare credentials without a length-dependent check.
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(authorization ?? ""), hash(expected)) ? 200 : 401;
}

export async function requireAppAccess(): Promise<void> {
  if (accessStatus(null) === 200) return;
  if (accessStatus((await headers()).get("authorization")) !== 200) {
    throw new Error("Application access denied");
  }
}
