import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordUserActivity } from "@/lib/auth/activity";

export async function POST(request: NextRequest) {
  // Next may construct request.url with its internal bind hostname. Compare
  // against the incoming HTTP Host, which the browser cannot spoof cross-site.
  // Do not trust a caller-supplied X-Forwarded-Host for this same-origin guard.
  const expectedOrigin = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expectedOrigin.host = host;
  if (request.headers.get("origin") !== expectedOrigin.origin) {
    return new NextResponse(null, { status: 403 });
  }
  if (!await getCurrentUser() || !await recordUserActivity()) {
    return new NextResponse(null, { status: 401 });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
