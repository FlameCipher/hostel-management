import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { createBookingTicket } from "@/lib/booking-requests";
import { TenantRegistrationForm } from "@/components/tenant-registration-forms";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Existing tenant registration", robots: { index: false, follow: false } };
export default async function TenantRegistrationPage() {
  const { property } = await requestPropertyContext();
  return <main className={`marketing-section ${styles.page}`} style={{ maxWidth: 720 }}><h1>Create my tenant account</h1>{property ? <section className={`panel ${styles.card}`}><h2>{property.name}</h2><p>Already staying here? Request access to your existing tenant record to message management, view your account and register visitors.</p><p className={styles.notice}>Management verifies your identity and room before activating access. This does not create another tenancy, change your rent or book a room. Requests expire after seven days.</p><TenantRegistrationForm ticket={createBookingTicket(`registration:${property.id}`)}/></section> : <section className={`panel ${styles.card}`}><p>Open your hostel&apos;s own website and choose Student sign in → Create my tenant account. Management can give you the correct address.</p><Link href="/">Find your hostel</Link></section>}<div className={styles.actions}><Link className="secondary-button" href="/tenant/login">Already registered? Sign in</Link><Link href="/help">How the system works</Link></div></main>;
}
