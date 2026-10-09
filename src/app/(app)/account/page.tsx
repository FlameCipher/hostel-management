import Link from "next/link";
import { WhatsAppPreferences } from "@/components/whatsapp-preferences";
import { PushSettings } from "@/components/push-settings";
import { ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AccountSecurityForm } from "@/components/account-security-form";
import styles from "@/components/account-security.module.css";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const session = await requireSession();
  const user = await db.user.findFirstOrThrow({ where: { id: session.userId, organizationId: session.organizationId, active: true }, select: { email: true, name: true, platformUserId: true } });
  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>My account</p>
      <h1>Email and password</h1>
      <p>Manage your private hostel login and keep your account secure.</p>
    </header>
    <section className={styles.identity} aria-label="Current account">
      <ShieldCheck size={24} aria-hidden="true"/>
      <div><p>Signed in as</p><strong>{user.name}</strong><span>{user.email}</span></div>
    </section>
    {user.platformUserId && <section className={styles.connection} aria-labelledby="connected-account-title">
      <h2 id="connected-account-title">SYSTEM IN ONE connection</h2>
      <p>Your accounts stay connected when you change your hostel login email. Your SYSTEM IN ONE email and password are managed separately.</p>
      {session.platformSubject && <p>Confirm changes using your current SYSTEM IN ONE password. You can also create a hostel password here.</p>}
      <a href="https://systeminone.com/account/security">Manage SYSTEM IN ONE password</a>
    </section>}
    <PushSettings/><WhatsAppPreferences/>
    <div className={styles.forms}>
      <AccountSecurityForm operation="email" shared={Boolean(session.platformSubject)}/>
      <AccountSecurityForm operation="password" shared={Boolean(session.platformSubject)}/>
    </div>
    <p className={styles.note}>These changes affect your login only. To update your public website contact details, go to <Link href="/settings">Settings</Link>.</p>
  </div>;
}
