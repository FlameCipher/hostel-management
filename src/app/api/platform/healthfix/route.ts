import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectHealthfix, healthfixAuthorized } from "@/lib/healthfix";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!healthfixAuthorized(process.env.HEALTHFIX_CONNECTOR_SECRET, request.headers.get("x-healthfix-connector-secret"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  // HTTP 200 means collection succeeded, not that modules are healthy. This allows
  // the platform collector to ingest failures rather than discard their evidence.
  const report = await collectHealthfix(db);
  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
