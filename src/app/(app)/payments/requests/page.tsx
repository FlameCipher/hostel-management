import styles from "@/components/rent-payment.module.css";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { activeRentGateway } from "@/lib/rent-payments";
import { RENT_ORGANIZATION } from "@/lib/pesapal-api";
import { formatMoney, roundCurrency } from "@/lib/currency";
import { RentRequestForm } from "@/components/rent-request-form";
import { RentRequestShare } from "@/components/rent-request-share";
import { staffRentRequestAction } from "./actions";
export default async function RentRequestsPage({ searchParams }: { searchParams: Promise<{ chargeId?: string; created?: string; send?: string }> }) {
  const session = await requireStaffFinanceAccess();
  if (session.organizationId !== RENT_ORGANIZATION) notFound();
  const params = await searchParams;
  const [gateway, charges, requests] = await Promise.all([
    activeRentGateway(db, session.organizationId),
    db.charge.findMany({ where: { organizationId: session.organizationId, currency: "KES", status: { notIn: ["FULLY_PAID", "WAIVED"] } }, include: { student: { include: { guardian: true } }, payments: { where: { reversedAt: null }, select: { amount: true } } }, orderBy: { dueDate: "asc" } }),
    db.rentPaymentRequest.findMany({ where: { organizationId: session.organizationId }, include: { charge: { include: { student: { select: { fullName: true } } } }, payment: { select: { id: true, receiptNumber: true, reversedAt: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const options = charges.map(c => ({ id: c.id, label: c.student.fullName + " · " + c.description, balance: roundCurrency(Number(c.amount) - c.payments.reduce((s, p) => s + Number(p.amount), 0), "KES"), student: { name: c.student.fullName, email: c.student.email || "", phone: c.student.phone }, ...(c.student.guardian ? { guardian: { name: c.student.guardian.name, email: c.student.guardian.email || "", phone: c.student.guardian.phone } } : {}) })).filter(c => c.balance > 0);
  const labels: Record<string, string> = { READY: "Awaiting payer", CREATING: "Preparing checkout", CHECKING: "Checking checkout — do not request again", PENDING: "Awaiting payment confirmation", FAILED: "Payment not completed", COMPLETED: "Payment verified automatically", REVERSED: "Payment reversed by provider", REVIEW: "Payment needs investigation" };
  return <div className={styles.page}><Link href="/payments">← Payments</Link><h1>Request a rent payment</h1><p>Choose a student and amount, then request payment from the student, a parent, guardian or another payer. Confirmed online payments update rent records automatically.</p><p>Cash received? <Link href="/payments/new?method=CASH">Record cash received</Link>.</p>
    {params.created && <p role="status">Payment request created.{params.send === "failed" ? " The email was not confirmed sent. Use the request link below; do not create another request." : " Its sending status is shown below."}</p>}
    {gateway ? <section className={styles.card}><RentRequestForm action={staffRentRequestAction} charges={options} selectedId={options.some(c => c.id === params.chargeId) ? params.chargeId : undefined} requestId={"R-" + randomUUID()}/></section> : <section className={styles.card}><h2>Automatic connection needed</h2><p>The existing general payment page is available, but automatic matching requires the secure gateway connection.</p>{session.role === "OWNER" ? <Link className="primary-button" href="/payments/gateway">Connect existing Pesapal account</Link> : <p>Ask the hostel owner to complete the one-time connection.</p>}</section>}
    <h2>Recent payment requests</h2>{!requests.length && <p>No individual requests yet.</p>}{requests.map(r => <article key={r.id} className={styles.card} id={r.id}><h3>{r.charge.student.fullName} · {formatMoney(Number(r.amount), r.currency)}</h3><p>{r.charge.description}</p><p>Payer: {r.payerName} · {r.payerEmail || r.payerPhone}</p><p><strong>{r.payment?.reversedAt ? "Receipt reversed" : labels[r.status] || "Checking payment"}</strong></p>{r.exception && <p>Attention: {r.exception === "PROVIDER_CHECK_RETRY" ? "Pesapal is temporarily unavailable. The system will retry automatically. Do not record the payment again." : "The system could not safely match this payment. Review the Pesapal transaction before taking further action."}</p>}<p>{r.emailStatus === "SENT" ? "Request email sent; inbox delivery is unconfirmed." : r.emailStatus === "FAILED" || r.emailStatus === "SENDING" ? "Request email sending is unconfirmed." : "Request email not sent."}</p>{r.payment ? <Link href={`/payments/${r.payment.id}/receipt`}>View receipt {r.payment.receiptNumber}</Link> : r.expiresAt > new Date() && ["READY", "PENDING", "FAILED"].includes(r.status) ? <><Link className="primary-button" href={`/rent-request/${r.token}`}>Open payment / M-Pesa checkout</Link><RentRequestShare token={r.token}/></> : <p>This request is being checked or has expired. Do not ask the payer to pay twice.</p>}</article>)}
  </div>;
}
