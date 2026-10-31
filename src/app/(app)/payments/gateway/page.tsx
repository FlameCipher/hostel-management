import styles from "@/components/rent-payment.module.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { activeRentGateway } from "@/lib/rent-payments";
import { RENT_ORGANIZATION } from "@/lib/pesapal-api";
import { ConnectRentGatewayForm } from "@/components/rent-request-form";
import { connectRentGatewayAction } from "../requests/actions";
export default async function RentGatewayPage() {
  const session = await requireStaffFinanceAccess();
  if (session.role !== "OWNER" || session.organizationId !== RENT_ORGANIZATION) notFound();
  const gateway = await activeRentGateway(db, session.organizationId);
  return <div className={styles.page}><Link href="/payments">← Payments</Link><h1>Automatic rent payments</h1><p>Connect the existing SAMPESA Pesapal account for MMAMBUGUA HOSTEL.</p>{gateway ? <section className={styles.card}><h2>Connected — automatic verification enabled</h2><p>Payments made through student accounts and individual payment requests are checked directly with Pesapal. Confirmed payments update the student’s balance and create a hostel receipt. Cash is recorded separately.</p><p>The earlier general Pesapal store link does not identify a hostel charge automatically. Its payments still need matching.</p><Link className="primary-button" href="/payments/requests">Request a payment</Link></section> : <section className={styles.card}><h2>One-time secure connection</h2><p>Use the consumer key and consumer secret from <a href="https://business.pesapal.com/settings" target="_blank" rel="noopener noreferrer">Pesapal Developer settings</a>. Enter them here, never in a chat or message.</p>{process.env.VERCEL_ENV === "production" ? <ConnectRentGatewayForm action={connectRentGatewayAction}/> : <p>Live payment connections are available only on the production hostel website.</p>}</section>}</div>;
}
