import Link from "next/link";
import { notFound } from "next/navigation";
import { RentPaymentLink } from "@/components/rent-payment-link";
import { requestPropertyContext } from "@/lib/property-host";
import { organizationCurrency } from "@/lib/organization-currency";
import { hostelRentCollection } from "@/lib/rent-collection";

export const metadata = { title: "Pay rent | MMAMBUGUA HOSTEL", robots: { index: false, follow: false } };

export default async function PayRentPage() {
  const { property } = await requestPropertyContext();
  if (!property) notFound();
  const collection = hostelRentCollection(property.organizationId, await organizationCurrency(property.organizationId));
  if (!collection) notFound();

  return <main className="marketing-section" style={{ maxWidth: 760, margin: "0 auto" }}>
    <Link href="/">← {property.name}</Link>
    <p className="eyebrow">Rent payments</p>
    <h1>Pay your hostel rent</h1>
    <p>Pay MMAMBUGUA HOSTEL through its SAMPESA payment account. The merchant name on Pesapal is <strong>{collection.merchant}</strong>.</p>
    <section className="panel entity-form" aria-label="How to pay rent">
      <h2>Three simple steps</h2>
      <ol style={{ paddingLeft: "1.5rem", lineHeight: 1.8 }}>
        <li><strong>Check your amount.</strong> <Link href="/tenant/account">View your student account</Link> or confirm the amount with management. New students must confirm their room and charge with management before paying.</li>
        <li><strong>Enter your details on Pesapal.</strong> Select Kenya and KES. Enter the student’s full registered name, room number, semester or rent period, and the amount you intend to pay. A parent or guardian can pay using their own payer contact details and the student’s details in the required student field. In Description, write “Hostel rent” and the student’s name and room.</li>
        <li><strong>Keep your payment confirmation.</strong> Complete the payment using a method offered by Pesapal. Keep the transaction reference and share it with management for verification and your hostel receipt.</li>
      </ol>
      <RentPaymentLink share/>
    </section>
    <section className="panel entity-form mt-5" aria-label="After payment">
      <h2>After you pay</h2>
      <p>Your hostel balance updates after management verifies the payment in Pesapal and records it against your rent charge. This payment link does not update your hostel balance automatically.</p>
      <p>If Pesapal confirms payment but your hostel balance is unchanged, contact management with the reference before paying again.</p>
      <div className="portal-access-actions"><Link className="secondary-button" href="/tenant/account">View my account</Link><a className="secondary-button" href="tel:+254714464701">Call management</a></div>
    </section>
  </main>;
}
