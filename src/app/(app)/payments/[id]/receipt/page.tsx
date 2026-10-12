import { formatMoney, roundCurrency } from "@/lib/currency";
import { currentRentAccountDisplay } from "@/lib/current-rent-account-display";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Download, Mail, PencilLine } from "lucide-react";
import { emailPendingReceiptAction } from "./email-action";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { ReceiptShareActions } from "@/components/receipt-share-actions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import "@/components/receipt-toolbar.css";


export default async function PaymentReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{delivery?: string; correction?: string}>;
}) {

  const session = await requireSession();
  const { id } = await params;
  const paramsQuery=await searchParams;
  const payment = await db.payment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      organization: true,
      student: true,
      recordedBy: true,
      reversedBy: true,
      charge: {
        include: {
          occupancy: { include: { room: {include:{roomType:true}}, semester: true } },
          payments: { where: { reversedAt: null } },
        },
      },
    },
  });
  if (!payment) notFound();
  const reversalAudit = payment.reversedAt ? await db.auditLog.findFirst({
    where: {
      organizationId: session.organizationId,
      action: "PAYMENT_REVERSED_INTERNAL",
      entityType: "Payment", entityId: payment.id,
    },
    orderBy: {createdAt: "desc"},
    select: {metadata: true},
  }) : null;
  const reversalMeta=reversalAudit?.metadata;
  const replacementPaymentId = reversalMeta && typeof reversalMeta==="object" && !Array.isArray(reversalMeta)
    && "replacementPaymentId" in reversalMeta && typeof reversalMeta.replacementPaymentId==="string"
    ? reversalMeta.replacementPaymentId : null;
  const money = (value: number) => formatMoney(value, payment.currency);

  const paid = payment.charge.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = Math.max(0, roundCurrency(Number(payment.charge.amount) - paid, payment.currency));
  const roomNumber = payment.charge.occupancy?.room.number ?? "Pending allocation";
  const semesterName = payment.charge.occupancy?.semester.name ?? payment.charge.description;
  const currentAccount = currentRentAccountDisplay({
    chargeType: payment.charge.type, description: payment.charge.description,
    chargeRoomTypeId: payment.charge.roomTypeId,
    semesterName: payment.charge.occupancy?.semester.name,
    occupancy: payment.charge.occupancy?.room ? {
      status:payment.charge.occupancy.status,
      room:{number: payment.charge.occupancy.room.number,
        roomType:{id:payment.charge.occupancy.room.roomType.id,
          name:payment.charge.occupancy.room.roomType.name}},
    }:null,
  });
  const currentAccountDifferent = !payment.reversedAt &&
    currentAccount.label !== currentAccount.originalDescription;
  const canCorrect=["OWNER","ADMIN"].includes(session.role) && !payment.reversedAt;
  const canEmail=["OWNER","ADMIN","MANAGER"].includes(session.role) && !payment.reversedAt && !!payment.student.email?.trim() && !(payment.receiptDeliveryChannel==="EMAIL"&&payment.receiptDeliveryStatus==="SENT");
  const emailStatus = !payment.student.email ? "No email recorded."
    : payment.receiptDeliveryChannel === "EMAIL" && payment.receiptDeliveryStatus === "SENT" ? "Receipt emailed."
    : payment.receiptDeliveryStatus === "FAILED" ? "Email delivery failed."
    : payment.receiptDeliveryStatus === "PENDING" ? "Receipt is awaiting delivery."
    : "Email not sent.";

  return (
    <div className="receipt-page">
      <div className="receipt-toolbar print-hidden">
        <Link className="secondary-button no-underline" href="/payments"><ArrowLeft size={17} /> Payments</Link>
        <div className="heading-actions">
          <PrintReceiptButton />
          <Link className="secondary-button no-underline" href={`/payments/${payment.id}/receipt/pdf`} target="_blank">
            <Download size={17}/> PDF
          </Link>
          {!payment.reversedAt ? <ReceiptShareActions paymentId={payment.id} /> : null}
          {canEmail ? <form action={emailPendingReceiptAction.bind(null,payment.id)}>
            <button className="secondary-button" type="submit"><Mail size={17}/> Email receipt</button>
          </form> : null}
          {canCorrect ? <Link className="secondary-button no-underline" href={`/payments/${payment.id}/correct`}>
            <PencilLine size={17}/> Correct amount
          </Link> : null}
        </div>
      </div>

      {paramsQuery.correction==="applied" ? <p className="review-success print-hidden" role="status">
        Financial correction saved. The original receipt remains in the audit trail; this is the newly issued receipt.
      </p>:null}
      {paramsQuery.delivery==="email" ? <p className="review-success print-hidden" role="status">The email provider accepted this receipt for delivery.</p>:null}
      {paramsQuery.delivery==="in-progress" ? <p className="muted-note print-hidden" role="status">An email delivery attempt is already processing. Check the status before trying again.</p>:null}
      {paramsQuery.delivery==="failed" ? <p className="form-error print-hidden" role="alert">The receipt was saved, but email delivery failed. Check the delivery status before retrying.</p>:null}
      {paramsQuery.delivery==="already-sent" ? <p className="review-success print-hidden" role="status">This receipt was already emailed; no duplicate was sent.</p>:null}
      {paramsQuery.delivery==="no-email" ? <p className="form-error print-hidden" role="alert">No student email is recorded for this receipt.</p>:null}
      <p className="receipt-email-status print-hidden" role="status">{emailStatus}</p>
      {payment.reversedAt && replacementPaymentId ? <p className="print-hidden" role="status">
        This receipt was superseded by an internal correction. <Link href={`/payments/${encodeURIComponent(replacementPaymentId)}/receipt`}>Open the valid replacement receipt</Link>.
      </p>:null}

      <article className={`receipt-sheet ${payment.reversedAt ? "receipt-reversed" : ""}`}>
        {payment.reversedAt ? <div className="reversal-banner"><strong>REVERSED</strong><span>{payment.reversalType === "MPESA_CONFIRMED" ? "M-Pesa reversal confirmed" : "Internal correction"} · {payment.reversedAt.toLocaleDateString("en-KE")}</span><p>{payment.reversalReason}</p></div> : null}
        <header className="receipt-header">
          <span className="brand-mark"><Building2 size={21} /></span>
          <div><h1>{payment.organization.name}</h1><p>Official payment receipt</p></div>
          <div className="receipt-number"><span>Receipt number</span><strong>{payment.receiptNumber}</strong></div>
        </header>
        <div className="receipt-rule" />
        <div aria-hidden="true" style={{ position: "absolute", inset: "42% auto auto 8%", transform: "rotate(-25deg)", fontSize: "clamp(22px,4vw,42px)", fontWeight: 800, opacity: .045, pointerEvents: "none", whiteSpace: "nowrap" }}>{payment.organization.name} · OFFICIAL RECEIPT</div>
        <section className="receipt-meta">
          <div><span>Received from</span><strong>{payment.student.fullName}</strong><small>{payment.student.phone}{payment.student.email ? ` · ${payment.student.email}` : ""}</small></div>
          <div><span>Room and semester</span><strong>{roomNumber === "Pending allocation" ? roomNumber : `Room ${roomNumber}`}</strong><small>{semesterName}</small></div>
          <div><span>Payment date</span><strong>{payment.paidAt.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}</strong></div>
        </section>
        <section className="receipt-payment">
          <div><span>{currentAccountDifferent ? "Current rent account" : "Description"}</span>
            <strong>{currentAccountDifferent ? currentAccount.label : payment.charge.description}</strong>
            {currentAccountDifferent ? <small>Original accommodation and charge history remain preserved in the occupancy audit trail.</small> : null}
          </div>
          <div><span>Amount received</span><strong>{money(Number(payment.amount))}</strong></div>
        </section>
        <section className="receipt-details">
          <div><span>Security reference</span><strong>{payment.securityReference ?? "Legacy receipt"}</strong></div>
          <div><span>Issued</span><strong>{payment.issuedAt.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</strong></div>
          {payment.integrityHash ? <div><span>Integrity code</span><strong>{payment.integrityHash.slice(0, 24).toUpperCase()}</strong></div> : null}
          <div><span>Payment method</span><strong>{payment.method.replaceAll("_", " ")}</strong></div>
          <div><span>Reference</span><strong>{payment.reference || "Not applicable"}</strong></div>
          <div><span>Total charge</span><strong>{money(Number(payment.charge.amount))}</strong></div>
          <div><span>Balance remaining</span><strong>{money(balance)}</strong></div>
          {balance > 0 ? <div><span>Next balance due</span><strong>{payment.charge.dueDate.toLocaleDateString("en-KE", { timeZone: "UTC" })}</strong></div> : null}
        </section>
        <footer className="receipt-footer">
          <p>Received by: <strong>{payment.recordedBy?.name ?? "Hostel management"}</strong></p>
          {payment.reversedAt ? <p>Reversed by: <strong>{payment.reversedBy?.name ?? "Hostel management"}</strong></p> : null}
          <p>{payment.organization.ownerName} · {payment.organization.phone}</p>
          <small>{payment.securityReference ? <>Verify authenticity using Security Ref <strong>{payment.securityReference}</strong>. </> : null}{payment.reversedAt ? "This receipt is retained only as a reversal audit record and is not proof of an active payment." : "This computer-generated receipt is valid without a signature."}</small>
        </footer>
      </article>
    </div>
  );
}
