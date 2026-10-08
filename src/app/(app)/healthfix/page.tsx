import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectHealthfix, healthfixManager } from "@/lib/healthfix";
import { HealthfixRepairForm } from "@/components/healthfix-repair-form";
export const dynamic = "force-dynamic";
export default async function HealthfixPage() {
  const session = await requireSession();
  if (!await healthfixManager(db, session)) return <section className="panel"><h1>HealthFix unavailable</h1><p>Only active owners and administrators can review hostel health and run repairs.</p></section>;
  const report = await collectHealthfix(db, session.organizationId);
  const history = await db.auditLog.findMany({ where: { organizationId: session.organizationId, action: "HEALTHFIX_SAFE_REPAIR" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, createdAt: true, metadata: true } }).catch(() => null);
  return <div><div className="page-heading-row"><div><p className="eyebrow">Hostel monitoring</p><h1>HealthFix</h1><p>Current status: <strong>{report.status}</strong> · Checked {new Date(report.observedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p></div><form action="/healthfix" method="get"><button className="secondary-button">Refresh checks</button></form></div>
    <section className="panel entity-form"><h2>Controlled self-repair</h2><p>Automatically runs with daily processing at 8 a.m. Nairobi time. Interrupted sends older than 15 minutes are flagged for provider review. Expired invitation tokens are cleared. Repairs are recorded below when a change is made.</p><p>Uncertain emails are never resent by HealthFix. It does not change passwords, tenant access, accepted terms, rent, payments or receipt contents.</p><HealthfixRepairForm/><Link className="secondary-button" href="/communications/invitations">Review invitations</Link><Link className="secondary-button" href="/communications">Review communication emails</Link></section>
    <section className="entity-form mt-5"><h2>Module checks</h2><p>PASSING describes only the named check. UNKNOWN means an end-to-end flow or external service has not been verified. These checks do not prove every feature works.</p>{report.modules.map(m => <article className="panel entity-form" key={m.code}><h3>{m.name} · {m.status}</h3>{m.checks.map(c => <p key={c.code}><strong>{c.status}</strong> · {c.name}</p>)}</article>)}</section>
    <section className="panel entity-form mt-5"><h2>Latest 20 repairs</h2>{history === null ? <p>Repair history could not be loaded.</p> : history.length ? history.map(h => { const meta = h.metadata && typeof h.metadata === "object" && !Array.isArray(h.metadata) ? h.metadata : {}; return <article key={h.id}><strong>{h.createdAt.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</strong><p>{meta.source === "DAILY_CRON" ? "Daily processing" : "Management"}: {String(meta.interruptedInvitations ?? 0)} interrupted invitations; {String(meta.interruptedEmails ?? 0)} interrupted notice emails; {String(meta.expiredInvitations ?? 0)} expired invitation tokens.</p></article>; }) : <p>No safe repair changes recorded yet.</p>}</section></div>;
}
