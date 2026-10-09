import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { residentAlerts } from "@/lib/resident-alerts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const tenant = new URL(request.url).searchParams.get("audience") === "tenant";
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  try {
    const result = await residentAlerts(db, tenant ? await getTenantSession() : await getSession(), tenant);
    return NextResponse.json(result ?? { error: "Sign in with an eligible account to view live alerts." }, { status: result ? 200 : 401, headers });
  } catch { return NextResponse.json({ error: "Live alerts could not be loaded. Refresh or open the visitor register." }, { status: 503, headers }); }
}
