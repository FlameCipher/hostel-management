import styles from "@/components/password-recovery.module.css";
import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { RecoveryRequestForm } from "@/components/password-recovery-forms";
export const metadata = { title: "Recover your password", robots: { index: false, follow: false } };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const [context, params] = await Promise.all([requestPropertyContext(), searchParams]);
  const tenant = params.account === "tenant";
  return <main className={styles.page}><p className="eyebrow">{context.property?.name ?? "StudentsHostels"}</p><h1>Forgot your password?</h1><p>Recover your {tenant ? "tenant" : "hostel management"} account using the email already registered on it.</p><RecoveryRequestForm kind={tenant ? "TENANT" : "MANAGEMENT"} shared={context.shared}/><p className={styles.help}>No access to your registered email? Contact hostel management for identity verification. A linked management account can also use <a href="/api/platform/sso/start">SYSTEM IN ONE sign-in</a>.</p><p className={styles.help}><Link href={tenant ? "/tenant/login" : "/login"}>Back to sign in</Link></p></main>;
}
