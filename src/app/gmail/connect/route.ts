import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/access";
import { gmailConfig, GMAIL_SCOPE } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  await requireAppAccess();
  const config = gmailConfig();
  if (request.headers.get("origin") !== new URL(config.redirectUri).origin) return new NextResponse("Invalid origin", { status: 403 });
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const { createHash } = await import("node:crypto");
  (await cookies()).set("gmail_oauth", JSON.stringify({ state, verifier }), {
    httpOnly: true, secure: new URL(config.redirectUri).protocol === "https:", sameSite: "lax", maxAge: 600, path: "/gmail",
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent", state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return NextResponse.redirect(url, 303);
}
