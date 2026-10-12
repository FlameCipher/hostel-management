import { getSession } from "@/lib/auth/session";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!["OWNER","ADMIN","MANAGER"].includes(session.role))
    return Response.json({error:"Finance permission required."},{status:403});

  const { id } = await params;
  const payment=await db.payment.findFirst({
    where:{id,organizationId:session.organizationId,reversedAt:null},
    select:{id:true,receiptDeliveryStatus:true,receiptDeliveryChannel:true},
  });
  if(!payment) return Response.json({error:"Active receipt not found."},{status:404});
  if(payment.receiptDeliveryStatus==="SENT"&&payment.receiptDeliveryChannel==="EMAIL")
    return Response.json({delivered:true,alreadyDelivered:true});
  const result = await deliverPaymentReceipt(id, session.organizationId);
  if (result !== "email") {
    return Response.json(
      { error: result === "whatsapp" ? "This student has no email address." : "The PDF receipt could not be emailed." },
      { status: 422 },
    );
  }

  return Response.json({ delivered: true });
}
