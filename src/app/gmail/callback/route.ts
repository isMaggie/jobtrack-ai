import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/access";
import { connectGmail, gmailConfig, reportGmailCallbackFailure, type GmailConnectionStage } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  await requireAppAccess();
  const jar = await cookies();
  const saved = jar.get("gmail_oauth")?.value;
  jar.set("gmail_oauth", "", { path: "/gmail", maxAge: 0 });
  let result = "error";
  let stage: "callback_validation" | GmailConnectionStage = "callback_validation";
  try {
    const session = JSON.parse(saved ?? "null");
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    if (!session || !state || session.state !== state || !code || code.length > 4096) throw new Error("Invalid OAuth callback");
    await connectGmail(code, session.verifier, (current) => { stage = current; });
    result = "connected";
  } catch { reportGmailCallbackFailure(stage); }
  return NextResponse.redirect(new URL(`/applications/import?gmail=${result}`, gmailConfig().redirectUri));
}
