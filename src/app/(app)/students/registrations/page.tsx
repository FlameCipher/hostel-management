import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { whatsappNumber } from "@/lib/whatsapp-policy";
import { normalizedResidentName } from "@/lib/resident-policy";
import { summarizeTenantReadiness } from "@/lib/tenant-visitor-operations-summary";
import { RegistrationReviewForm } from "@/components/tenant-registration-forms";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ page?: string; history?: string }> }) {
  const s = await requireSession(); if (!await residentStaff(db, s, true)) return <section className={`panel ${styles.card}`}><h1>Tenant registration</h1><p>Only owners, administrators and managers may review identity and activate accounts.</p></section>;
  const p = await searchParams, page = Math.min(10000, Math.max(1, Math.floor(Number(p.page) || 1))), history = p.history === "1", now = new Date();
  const requests = await db.tenantRegistration.findMany({ where: { organizationId: s.organizationId, ...(history ? {} : { status: "PENDING", expiresAt: { gt: now } }) }, select: { id: true, fullName: true, phone: true, roomNumber: true, propertyId: true, property: { select: { name: true, countryCode: true } }, expiresAt: true, status: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 });
  const students = await db.student.findMany({ where: { organizationId: s.organizationId, status: "ACTIVE", portalEnabled: false, portalPasswordHash: null, portalLastLoginAt: null, portalInviteBlocked: false, occupancies: { some: { organizationId: s.organizationId, status: "ACTIVE", room: { propertyId: { in: requests.map(r => r.propertyId) }, organizationId: s.organizationId } } } }, select: { id: true, fullName: true, phone: true, occupancies: { where: { organizationId: s.organizationId, status: "ACTIVE" }, select: { room: { select: { number: true, propertyId: true } } } } } });
  const [activeStudents,portalEnabled,eligibleForApproval,pendingRequests,expiredRequests,totalVisitorRequests] = await Promise.all([
    db.student.count({where:{organizationId:s.organizationId,status:"ACTIVE"}}),
    db.student.count({where:{organizationId:s.organizationId,status:"ACTIVE",portalEnabled:true}}),
    db.student.count({where:{
      organizationId:s.organizationId,status:"ACTIVE",
      portalEnabled:false,portalPasswordHash:null,portalLastLoginAt:null,
      portalInviteBlocked:false,
      occupancies:{some:{organizationId:s.organizationId,status:"ACTIVE"}},
    }}),
    db.tenantRegistration.count({where:{organizationId:s.organizationId,status:"PENDING",expiresAt:{gt:now}}}),
    db.tenantRegistration.count({where:{organizationId:s.organizationId,status:"PENDING",expiresAt:{lte:now}}}),
    db.visitorRequest.count({where:{organizationId:s.organizationId}}),
  ]);
  const overview=summarizeTenantReadiness({
    activeStudents,portalEnabled,eligibleForApproval,pendingRequests,
    expiredRequests,totalVisitorRequests,
  });
  return <div className={styles.page}><div className="page-heading-row"><h1>Tenant registration requests</h1><Link className="secondary-button" href={history ? "/students/registrations" : "?history=1"}>{history ? "Pending verification" : "Review history"}</Link></div>
  <section className="room-summary-grid">
    <article className="compact-stat"><div><p>Active students</p><strong>{overview.activeStudents}</strong></div></article>
    <article className="compact-stat"><div><p>Portal enabled</p><strong>{overview.portalEnabled}</strong></div></article>
    <article className="compact-stat"><div><p>Eligible, not enabled</p><strong>{overview.eligibleForApproval}</strong></div></article>
    <article className="compact-stat"><div><p>Requests awaiting verification</p><strong>{overview.pendingRequests}</strong></div></article>
  </section>
  <section className={`panel ${styles.card} mt-5`}>
    <h2>Tenant portal onboarding</h2>
    <p>Existing residents register themselves from their hostel's branded website through
      <strong> Student sign in → Create my tenant account</strong>.
      Management independently verifies the registered name, phone and current room before
      linking the request. A request does not create a second tenant, reserve a room or change rent.</p>
    <p>{overview.notYetEnabled} active student account{overview.notYetEnabled===1?" is":"s are"}
      not yet enabled. {overview.expiredRequests} request{overview.expiredRequests===1?" has":"s have"}
      passed the seven-day verification window without approval. No account is automatically activated.</p>
    <div className={styles.actions}>
      <Link className="secondary-button" href="/students">Open student register</Link>
      <Link className="secondary-button" href="/communications/invitations">Review tenant invitations</Link>
      <Link className="secondary-button" href="/visitors">Visitor gate dashboard</Link>
    </div>
  </section>
  <p>Confirm identity independently, then link each request to the matching current tenant.
    This cannot overwrite an existing portal password.</p>{requests.length ? requests.slice(0, 20).map(r => { const expired = r.status === "PENDING" && r.expiresAt <= now; const candidates = students.filter(t => normalizedResidentName(t.fullName) === normalizedResidentName(r.fullName) && whatsappNumber(t.phone, r.property.countryCode) === r.phone && t.occupancies.some(o => o.room.propertyId === r.propertyId && o.room.number.toLowerCase() === r.roomNumber.toLowerCase())); return <section className={`panel ${styles.card}`} key={r.id}><h2>{r.fullName}</h2><p>{r.property.name} · room {r.roomNumber}<br/>+{r.phone}</p><p className={styles.meta}>{expired ? "EXPIRED" : r.status} · submitted {r.createdAt.toISOString().slice(0, 10)} · expires {r.expiresAt.toISOString().slice(0, 10)} (UTC)</p>{r.status === "PENDING" && !expired && <>{!candidates.length && <p className={styles.warning}>No eligible exact match. Verify the registered name, phone and current room. For an existing portal account, use account recovery.</p>}<RegistrationReviewForm id={r.id} candidates={candidates.map(c => ({ id: c.id, label: c.fullName }))}/></>}</section>; }) : <section className={`panel ${styles.card}`}><p>No registration requests in this view.</p></section>}<nav className={styles.actions}>{page > 1 && <Link href={`?history=${history ? 1 : 0}&page=${page - 1}`}>Previous</Link>}{requests.length > 20 && <Link href={`?history=${history ? 1 : 0}&page=${page + 1}`}>Next</Link>}</nav></div>;
}
