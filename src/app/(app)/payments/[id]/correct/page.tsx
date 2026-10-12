import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PaymentAmountCorrectionForm } from "@/components/payment-amount-correction-form";

export default async function CorrectPostedPaymentPage({
  params,
}: {params: Promise<{id:string}>}) {
  const session=await requireSession();
  if(!["OWNER","ADMIN"].includes(session.role))redirect("/payments");
  const {id}=await params;
  const payment=await db.payment.findFirst({
    where:{id,organizationId:session.organizationId},
    include:{
      student:{select:{fullName:true,email:true}},
      charge:{include:{
        occupancy:{include:{room:{include:{roomType:true}}}},
        payments:{where:{reversedAt:null},select:{amount:true}},
      }},
      mpesaTransaction:{select:{id:true}},
    },
  });
  if(!payment)notFound();
  if(payment.reversedAt)redirect(`/payments/${payment.id}/receipt`);
  const paid=payment.charge.payments.reduce((sum,item)=>sum+Number(item.amount),0);
  const room=payment.charge.occupancy?.room;
  const roomLabel=room?`Room ${room.number} · ${room.roomType.name}`:"Assigned rent charge";
  return <div className="narrow-page">
    <div className="page-heading-row">
      <div><p className="eyebrow">Finance integrity</p><h1>Correct a posted payment</h1>
        <p>Owner/Admin only · {payment.receiptNumber}</p></div>
      <Link className="secondary-button no-underline" href={`/payments/${payment.id}/receipt`}><ArrowLeft size={17}/> Receipt</Link>
    </div>
    {payment.mpesaTransaction?<div className="warning-callout"><ShieldAlert size={21}/>
      <div><strong>Provider reconciliation requires manual review</strong>
        <p>This payment is linked to an imported M-Pesa transaction. Confirm the provider record before changing its internal amount. The original receipt remains unchanged.</p>
      </div>
    </div>:<PaymentAmountCorrectionForm
      paymentId={payment.id} receiptNumber={payment.receiptNumber}
      studentName={payment.student.fullName} roomLabel={roomLabel}
      currency={payment.currency} oldAmount={Number(payment.amount)}
      activePaid={paid} chargeAmount={Number(payment.charge.amount)}
      studentHasEmail={Boolean(payment.student.email?.trim())}/>}
  </div>;
}
