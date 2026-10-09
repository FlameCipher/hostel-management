import styles from "@/components/password-recovery.module.css";
import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";
import { usablePasswordRecovery } from "@/lib/password-recovery";
import { RecoveryResetForm } from "@/components/password-recovery-forms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Set a new password", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, context] = await Promise.all([params, requestPropertyContext()]);
  const recovery = await usablePasswordRecovery(db, token, context.host).catch(() => null);
  return <main className={styles.page}><p className="eyebrow">{recovery?.property.name ?? "Account recovery"}</p><h1>{recovery ? "Choose a new password" : "Reset link unavailable"}</h1>{recovery ? <><p>Use at least 12 characters. Changing this password signs out previous hostel sessions.</p><RecoveryResetForm token={token} tenant={recovery.kind === "TENANT"}/></> : <><p>This link is invalid, expired, already used, or belongs to a different hostel website. Open the exact link in your email, or request a new one.</p><p><Link href="/forgot-password">Recover a management account</Link></p><p><Link href="/forgot-password?account=tenant">Recover a tenant account</Link></p></>}</main>;
}
