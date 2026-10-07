import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { tenantTermsRecord } from "@/lib/hostel-terms/service";
import { termsPdfResponse } from "@/lib/hostel-terms/pdf";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTenantSession();
  if (!session) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  return termsPdfResponse(await tenantTermsRecord(db, session, (await params).id));
}
