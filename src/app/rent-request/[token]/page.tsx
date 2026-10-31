import styles from "@/components/rent-payment.module.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { RENT_ORGANIZATION } from "@/lib/pesapal-api";
import { RentRequestShare } from "@/components/rent-request-share";
import { RentCheckoutButton, RentPaymentRefresh } from "@/components/rent-checkout";
import { startRentCheckoutAction, checkRentPaymentAction } from "./actions";
export const metadata = { title: "Rent payment request", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function RentRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{43}$/.test(token)) notFound();
  const request = await db.rentPaymentRequest.findFirst({ where: { token, organizationId: RENT_ORGANIZATION }, include: { charge: { select: { description: true, student: { select: { fullName: true } } } }, payment: { select: { receiptNumber: true, reversedAt: true, reference: true } } } });
  if (!request) notFound();
  const completed = request.status === "COMPLETED" && request.payment && !request.payment.reversedAt;
  const reversed = request.status === "REVERSED" || request.payment?.reversedAt;
  const expired = request.expiresAt < new Date();
  const canPay = !expired && !request.paymentId && ["READY", "PENDING", "FAILED"].includes(request.status);
  return <main className={styles.page}><p className="eyebrow">MMAMBUGUA HOSTEL</p><h1>{completed ? "Payment received" : reversed ? "Payment reversed" : "Rent payment request"}</h1><section className={styles.card}><h2>{formatMoney(Number(request.amount), request.currency)}</h2><p>For <strong>{request.charge.student.fullName}</strong><br/>{request.charge.description}</p><p>Requested from {request.payerName}. The student and rent charge are already linked to this request.</p><p>Collected through <strong>Sampesa Group Limited</strong> on Pesapal.</p>
    {completed ? <><p>Your payment has been verified directly with Pesapal. The student’s balance has been updated automatically.</p><p>Receipt: <strong>{request.payment!.receiptNumber}</strong><br/>Payment reference: {request.payment!.reference}</p><a className="primary-button" href={`/rent-request/${token}/receipt`}>Download hostel receipt</a></> : reversed ? <p>This payment or its hostel receipt has been reversed. Check the student account or contact management before making another payment.</p> : <>
      {request.status === "REVIEW" ? <p role="alert">We received a payment update that needs investigation. Management can review it. Do not pay again while this is being checked.</p> : ["CREATING", "CHECKING"].includes(request.status) ? <p>Your checkout is being checked. Do not create another payment request.</p> : request.status === "FAILED" ? <p>Pesapal has not confirmed a successful payment. If money was deducted, check the status before retrying.</p> : request.status === "PENDING" ? <p>Payment confirmation is pending. If you already paid, wait for verification instead of paying again.</p> : expired ? <p>This payment request has expired. Ask for a new request.</p> : <p>Choose your payment method at checkout and authorise the payment yourself. Confirmation and the hostel receipt are automatic after successful payment.</p>}
      {canPay && <RentCheckoutButton action={startRentCheckoutAction.bind(null, token)}/>}{canPay && request.status === "READY" && <details><summary>Share this request with the payer</summary><RentRequestShare token={token}/></details>}
      {request.trackingId && <><RentPaymentRefresh/><form action={checkRentPaymentAction.bind(null, token)}><button className="secondary-button">Check payment status</button></form></>}
    </>}
    <p><Link href="/tenant/account">Student account</Link> · <a href="tel:+254714464701">Contact management</a></p></section></main>;
}
