import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, RotateCcw } from "lucide-react";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { ReceiptShareActions } from "@/components/receipt-share-actions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export default async function PaymentReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ delivery?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { delivery } = await searchParams;
  const payment = await db.payment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      organization: true,
      student: true,
      recordedBy: true,
      reversedBy: true,
      charge: {
        include: {
          occupancy: { include: { room: true, semester: true } },
          payments: { where: { reversedAt: null } },
        },
      },
    },
  });
  if (!payment) notFound();

  const paid = payment.charge.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = Math.max(0, Number(payment.charge.amount) - paid);
  const roomNumber = payment.charge.occupancy?.room.number ?? "Pending allocation";
  const semesterName = payment.charge.occupancy?.semester.name ?? payment.charge.description;
  const canReverse = ["OWNER", "ADMIN"].includes(session.role) && !payment.reversedAt;
  const shareMessage = [
    `${payment.organization.name} payment receipt`,
    `Receipt: ${payment.receiptNumber}`,
    `Student: ${payment.student.fullName}`,
    `Room: ${roomNumber === "Pending allocation" ? roomNumber : `Room ${roomNumber}`}`,
    `Amount: ${money(Number(payment.amount))}`,
    `Payment method: ${payment.method.replaceAll("_", " ")}`,
    `Reference: ${payment.reference ?? "Not applicable"}`,
    `Balance: ${money(balance)}`,
    `${payment.organization.ownerName} · ${payment.organization.phone}`,
  ].join("\n");

  return (
    <div className="receipt-page">
      <div className="receipt-toolbar print-hidden">
        <Link className="secondary-button no-underline" href="/payments"><ArrowLeft size={17} /> Payments</Link>
        <div className="heading-actions">
          <ReceiptShareActions
            autoOpenWhatsApp={delivery === "whatsapp" && !payment.reversedAt}
            email={payment.student.email}
            message={shareMessage}
            phone={payment.student.phone}
            pdfUrl={`/payments/${payment.id}/receipt/pdf`}
            receiptNumber={payment.receiptNumber}
          />
          {canReverse ? <Link className="danger-button no-underline" href={`/payments/${payment.id}/reverse`}><RotateCcw size={17} /> Reverse payment</Link> : null}
          <PrintReceiptButton />
        </div>
      </div>

      {delivery === "email" ? <div className="form-success print-hidden">PDF receipt emailed automatically to {payment.student.email}.</div> : null}
      {delivery === "whatsapp" ? <div className="policy-banner print-hidden"><div><strong>No student email recorded</strong><p>The prepared receipt is opening in WhatsApp. Use the WhatsApp button above if it does not open.</p></div></div> : null}
      {delivery === "failed" ? <div className="form-error print-hidden">Automatic email delivery failed. You can still use Email, WhatsApp, Share, or Print above.</div> : null}

      <article className={`receipt-sheet ${payment.reversedAt ? "receipt-reversed" : ""}`}>
        {payment.reversedAt ? <div className="reversal-banner"><strong>REVERSED</strong><span>{payment.reversalType === "MPESA_CONFIRMED" ? "M-Pesa reversal confirmed" : "Internal correction"} · {payment.reversedAt.toLocaleDateString("en-KE")}</span><p>{payment.reversalReason}</p></div> : null}
        <header className="receipt-header">
          <span className="brand-mark"><Building2 size={21} /></span>
          <div><h1>{payment.organization.name}</h1><p>Official payment receipt</p></div>
          <div className="receipt-number"><span>Receipt number</span><strong>{payment.receiptNumber}</strong></div>
        </header>
        <div className="receipt-rule" />
        <section className="receipt-meta">
          <div><span>Received from</span><strong>{payment.student.fullName}</strong><small>{payment.student.phone}{payment.student.email ? ` · ${payment.student.email}` : ""}</small></div>
          <div><span>Room and semester</span><strong>{roomNumber === "Pending allocation" ? roomNumber : `Room ${roomNumber}`}</strong><small>{semesterName}</small></div>
          <div><span>Payment date</span><strong>{payment.paidAt.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}</strong></div>
        </section>
        <section className="receipt-payment">
          <div><span>Description</span><strong>{payment.charge.description}</strong></div>
          <div><span>Amount received</span><strong>{money(Number(payment.amount))}</strong></div>
        </section>
        <section className="receipt-details">
          <div><span>Payment method</span><strong>{payment.method.replaceAll("_", " ")}</strong></div>
          <div><span>Reference</span><strong>{payment.reference || "Not applicable"}</strong></div>
          <div><span>Total charge</span><strong>{money(Number(payment.charge.amount))}</strong></div>
          <div><span>Balance remaining</span><strong>{money(balance)}</strong></div>
          {balance > 0 ? <div><span>Next balance due</span><strong>{payment.charge.dueDate.toLocaleDateString("en-KE", { timeZone: "UTC" })}</strong></div> : null}
          <div><span>Receipt delivery</span><strong>{payment.receiptDeliveryStatus.replaceAll("_", " ")}</strong></div>
        </section>
        <footer className="receipt-footer">
          <p>Received by: <strong>{payment.recordedBy?.name ?? "Hostel management"}</strong></p>
          {payment.reversedAt ? <p>Reversed by: <strong>{payment.reversedBy?.name ?? "Hostel management"}</strong></p> : null}
          <p>{payment.organization.ownerName} · {payment.organization.phone}</p>
          <small>{payment.reversedAt ? "This receipt is retained only as a reversal audit record and is not proof of an active payment." : "This computer-generated receipt is valid without a signature."}</small>
        </footer>
      </article>
    </div>
  );
}
