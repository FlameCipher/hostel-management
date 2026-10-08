import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AccountSecurityForm } from "@/components/account-security-form";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const session = await requireSession();
  const user = await db.user.findFirstOrThrow({ where: { id: session.userId, organizationId: session.organizationId, active: true }, select: { email: true, name: true, platformUserId: true } });
  return <div className="settings-stack"><div className="page-heading-row"><div><p className="eyebrow">My account</p><h1>Email and password</h1><p>{user.name} · Hostel login email: <strong>{user.email}</strong></p><p>Update your own private management login. Public website contact details are managed separately in <Link href="/settings">Settings</Link>.</p></div></div>
    {user.platformUserId && <section className="panel entity-form"><h2>SYSTEM IN ONE connection</h2><p>Your accounts remain connected when your hostel login email changes. These forms change your hostel login only. Your SYSTEM IN ONE email and password remain separate.</p><p><a className="secondary-button" href="https://systeminone.com/account/security">Manage SYSTEM IN ONE password</a></p>{session.platformSubject && <p>Confirm changes using your current SYSTEM IN ONE password. You can set a hostel password here even if you previously used only shared login.</p>}</section>}
    <AccountSecurityForm operation="email" shared={Boolean(session.platformSubject)}/><AccountSecurityForm operation="password" shared={Boolean(session.platformSubject)}/></div>;
}
