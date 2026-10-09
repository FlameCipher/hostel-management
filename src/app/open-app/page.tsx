import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { requestPropertyContext } from "@/lib/property-host";
import styles from "@/components/hostel-app.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Open your hostel account", robots: { index: false, follow: false } };
export default async function OpenAppPage() {
  const [{ property }, tenant, staff] = await Promise.all([requestPropertyContext(), getTenantSession(), getSession()]);
  if (tenant && !staff) redirect("/tenant/account");
  if (staff && !tenant) redirect("/dashboard");
  return <main className={`marketing-section ${styles.page}`}><p className="eyebrow">Welcome to your hostel app</p><h1>{property?.name ?? "StudentsHostels"}</h1><section className={styles.card}><h2>{tenant && staff ? "Choose an account" : "Sign in to continue"}</h2><p>Use your own account to see your permitted records.</p><div className={styles.actions}><Link className="primary-button" href="/tenant/account">{tenant ? "Open tenant account" : "Tenant sign in"}</Link><Link className="secondary-button" href="/dashboard">{staff ? "Open management" : "Owner or staff sign in"}</Link></div><p><Link href="/tenant/register">Existing resident? Create my tenant account</Link></p></section><nav className={styles.actions}><Link href="/">Hostel website</Link><Link href="/help">System help</Link><Link href="/install">Installation help</Link></nav></main>;
}
