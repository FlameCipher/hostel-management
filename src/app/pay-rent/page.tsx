import Link from "next/link";
import { db } from "@/lib/db";
import { activeRentGateway } from "@/lib/rent-payments";
import { notFound } from "next/navigation";
import { RentPaymentLink } from "@/components/rent-payment-link";
import { requestPropertyContext } from "@/lib/property-host";
import { organizationCurrency } from "@/lib/organization-currency";
import { hostelRentCollection } from "@/lib/rent-collection";
import styles from "./page.module.css";

export const metadata = { title: { absolute: "Pay rent | MMAMBUGUA HOSTEL" }, robots: { index: false, follow: false } };

export default async function PayRentPage() {
  const { property } = await requestPropertyContext();
  if (!property) notFound();
  const collection = hostelRentCollection(property.organizationId, await organizationCurrency(property.organizationId));
  if (!collection) notFound();

  const gateway = await activeRentGateway(db, property.organizationId);
  if (gateway) return <main className={styles.page}><Link href="/">← {property.name}</Link><h1>Pay your hostel rent</h1><section className={styles.card}><h2>Existing students</h2><p>Sign in, choose your rent charge and amount, then pay securely with Pesapal. The system verifies your payment, updates your balance and issues your receipt automatically.</p><Link className="primary-button" href="/tenant/pay">Sign in and pay rent</Link></section><section className={styles.card}><h2>Parents, guardians and other payers</h2><p>Open the individual payment request sent by the landlord or student. It already identifies the correct student and rent charge. You do not need a student login to pay that request.</p></section><section className={styles.card}><h2>New students</h2><p>Confirm your room and rent charge with management first. Management can send you a payment request once your student record and charge are created.</p><Link href="/book">Apply for accommodation</Link></section><section className={styles.card}><h2>After payment</h2><p>Payments are collected through Sampesa Group Limited on Pesapal. Keep your receipt. If money was deducted but confirmation is pending, wait for the system to verify it before paying again.</p><p>Cash payments must be recorded by management when received. Payments through the earlier general store link still need matching.</p></section></main>;
  return <main className={styles.page}>
    <Link href="/">← {property.name}</Link>
    <p className="eyebrow">Rent payments</p>
    <h1>Pay your hostel rent</h1>
    <p>Pay MMAMBUGUA HOSTEL through its SAMPESA payment account. The merchant name on Pesapal is <strong>{collection.merchant}</strong>.</p>
    <section className={styles.card} aria-label="How to pay rent">
      <h2>Three simple steps</h2>
      <ol className={styles.steps}>
        <li><strong>Check your amount.</strong> <Link href="/tenant/account">View your student account</Link> or confirm the amount with management. New students must confirm their room and charge with management before paying.</li>
        <li><strong>Enter your details on Pesapal.</strong> Select Kenya and KES. Enter the student’s full registered name, room number, semester or rent period, and the amount you intend to pay. A parent or guardian can pay using their own payer contact details and the student’s details in the required student field. In Description, write “Hostel rent” and the student’s name and room.</li>
        <li><strong>Keep your payment confirmation.</strong> Complete the payment using a method offered by Pesapal. Keep the transaction reference and share it with management for verification and your hostel receipt.</li>
      </ol>
      <RentPaymentLink share/>
    </section>
    <section className={styles.card} aria-label="After payment">
      <h2>After you pay</h2>
      <p>Your hostel balance updates after management verifies the payment in Pesapal and records it against your rent charge. This payment link does not update your hostel balance automatically.</p>
      <p>If Pesapal confirms payment but your hostel balance is unchanged, contact management with the reference before paying again.</p>
      <div className="portal-access-actions"><Link className="secondary-button" href="/tenant/account">View my account</Link><a className="secondary-button" href="tel:+254714464701">Call management</a></div>
    </section>
  </main>;
}
