import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { residentTenant } from "@/lib/resident-access";
import { hostelTimeZone } from "@/lib/resident-policy";
import { VisitorRequestForm } from "@/components/visitor-forms";
import { VisitorRecord } from "@/components/visitor-record";
import styles from "@/components/resident-services.module.css";
export const dynamic = "force-dynamic";
export default async function TenantVisitors({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const s = await requireTenantSession(), params = await searchParams, page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  if (!await residentTenant(db, s)) return <main className="marketing-section"><h1>Visitors</h1><p>Visitor requests require a current, active room allocation.</p><Link href="/tenant/account">My account</Link></main>;
  const rooms = await db.occupancy.findMany({ where: { organizationId: s.organizationId, studentId: s.studentId, status: "ACTIVE", room: { organizationId: s.organizationId, property: { active: true, organizationId: s.organizationId } }, semester: { organizationId: s.organizationId } }, include: { room: { include: { property: true } } } });
  const visits = await db.visitorRequest.findMany({ where: { organizationId: s.organizationId, studentId: s.studentId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21, include: { property: { select: { name: true } } } });
  return <main className={`marketing-section ${styles.page}`}><div className="page-heading-row"><h1>My visitors</h1><Link className="secondary-button" href="/tenant/account">My account</Link></div><section className={`panel ${styles.card}`}><h2>Expecting a visitor?</h2><p>Tell management who is visiting and when. Caretaker/security verifies entry and exit.</p><VisitorRequestForm requestId={randomUUID()} rooms={rooms.map(o => ({ id: o.id, label: `${o.room.property.name} · room ${o.room.number}`, timeZone: hostelTimeZone(o.room.property.timeZone, o.room.property.countryCode) }))}/></section><h2>My visitor records</h2>{visits.length ? visits.slice(0, 20).map(v => <VisitorRecord key={v.id} visit={v} tenant/>) : <p>No visits submitted yet.</p>}<nav className={styles.actions}>{page > 1 && <Link href={`?page=${page - 1}`}>Newer visits</Link>}{visits.length > 20 && <Link href={`?page=${page + 1}`}>Older visits</Link>}</nav></main>;
}
