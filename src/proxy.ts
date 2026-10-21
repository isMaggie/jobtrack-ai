import { NextRequest, NextResponse } from "next/server";
import { accessStatus } from "./lib/access";

// Cover every path and method, including Server Action POST requests.
export function proxy(request: NextRequest) {
  const status = accessStatus(request.headers.get("authorization"));
  if (status === 200) return NextResponse.next();
  return new NextResponse(status === 401 ? "Access required" : "Application access is not configured", {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="JobTrack AI", charset="UTF-8"' } : {}),
    },
  });
}
