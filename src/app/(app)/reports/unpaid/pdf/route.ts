import { sameOrigin } from "@/lib/service-security";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { prepareStaffReport } from "@/lib/unpaid-report";
import { unpaidReportPdf } from "@/lib/unpaid-report-pdf";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!sameOrigin(request)) return Response.json({error:"Open the report from your hostel website."},{status:403,headers});
  const session = await getSession();
  if (!session) return Response.json({error:"Sign in again."},{status:401,headers});
  try {
    const raw = await request.text();
    if (raw.length > 2000) return Response.json({error:"Invalid request."},{status:400,headers});
    const input = JSON.parse(raw);
    if (typeof input.recipientId!=="string" || typeof input.recipientPhone!=="string" || typeof input.fingerprint!=="string" || input.confirmed!==true) return Response.json({error:"Review the report and recipient."},{status:400,headers});
    const result = await prepareStaffReport(db, session, input);
    if ("error" in result) return Response.json({error:result.error},{status:409,headers});
    const bytes = await unpaidReportPdf(result.report,result.recipient);
    return new Response(Buffer.from(bytes),{headers:{...headers,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="unpaid-rent-staff.pdf"'}});
  } catch { return Response.json({error:"Could not prepare the PDF. Refresh and try again."},{status:500,headers}); }
}
