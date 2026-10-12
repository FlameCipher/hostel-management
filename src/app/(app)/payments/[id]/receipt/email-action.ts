"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deliverPaymentReceipt } from "@/lib/receipt-delivery";

/** Explicit management action. Never send a corrected or reversed receipt automatically on page load. */
export async function emailPendingReceiptAction(paymentId: string): Promise<void> {
  const session=await requireSession();
  if(!["OWNER","ADMIN","MANAGER"].includes(session.role))redirect("/payments");
  const actor=await db.user.findFirst({
    where:{id:session.userId,organizationId:session.organizationId,active:true,
      sessionVersion:session.sessionVersion,role:{in:["OWNER","ADMIN","MANAGER"]}},
    select:{id:true},
  });
  if(!actor)redirect("/login");
  const payment=await db.payment.findFirst({
    where:{id:paymentId,organizationId:session.organizationId},
    include:{student:{select:{email:true}}},
  });
  if(!payment || payment.reversedAt)redirect("/payments");
  const path=`/payments/${encodeURIComponent(payment.id)}/receipt`;
  if(!payment.student.email?.trim())redirect(`${path}?delivery=no-email`);
  if(payment.receiptDeliveryChannel==="EMAIL"&&payment.receiptDeliveryStatus==="SENT")
    redirect(`${path}?delivery=already-sent`);
  const delivery=await deliverPaymentReceipt(payment.id,session.organizationId);
  revalidatePath(path);
  revalidatePath("/payments");
  redirect(`${path}?delivery=${encodeURIComponent(delivery)}`);
}
