import Link from "next/link";
import { HostelInstallCard } from "@/components/hostel-app";
import styles from "@/components/hostel-app.module.css";
import { hostelAppIdentity } from "@/lib/hostel-app";
import { requestPropertyContext } from "@/lib/property-host";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { managedPropertyHost, publishedWhere } from "@/lib/property-host-policy";

export const metadata = { title: "Install your hostel app" };
export default async function InstallPage() {
  const { host, property } = await requestPropertyContext();
  const app = hostelAppIdentity(host, property);
  const session = !app ? await getSession() : null;
  const properties = session ? await db.property.findMany({ where: { ...publishedWhere(), organizationId: session.organizationId }, select: { id: true, name: true, customDomain: true } }) : property ? [property] : [];
  return <main className={`marketing-section ${styles.page}`}><p className="eyebrow">Your hostel, on your phone</p><h1>{app ? `Install ${app.name}` : "Install your hostel app"}</h1>
    {app ? <><p>Add this hostel&apos;s app icon to your Home Screen. Tenants, owners, caretakers and staff use the same app with their own accounts and permissions.</p><HostelInstallCard instructions/></> : <section className={styles.card}><h2>Start with your hostel&apos;s own website</h2><p>Each published hostel website provides its own installable app, with its own name and icon. Ask management for the correct website, or find your hostel below.</p>{properties.map(p => { const domain = managedPropertyHost(p.customDomain); return domain ? <p key={p.id}><a className="secondary-button" href={`https://${domain}/install`}>Install {p.name}</a></p> : null; })}<Link className="primary-button" href="/">Find my hostel</Link></section>}
    <section className={styles.card}><h2>One account, on the website and in the app</h2><p>Existing residents can request an account. Management verifies the request before access is activated. Installing the app does not create another tenancy or change your rent.</p><div className={styles.actions}><Link className="primary-button" href="/tenant/register">Create my tenant account</Link><Link className="secondary-button" href="/open-app">Open my account</Link></div></section>
    <nav className={styles.actions}><Link href="/">Hostel website</Link><Link href="/help">Help using the system</Link></nav>
  </main>;
}
