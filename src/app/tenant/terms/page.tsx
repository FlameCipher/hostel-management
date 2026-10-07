import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { currentTermsContext } from "@/lib/hostel-terms/service";
import { TERMS_VERSION, termsHash } from "@/lib/hostel-terms/policy";
import { TermsSignForm } from "./sign-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "My hostel terms", robots: { index: false, follow: false } };
export default async function TenantTermsPage() {
  const session = await requireTenantSession();
  const context = await currentTermsContext(db, session);
  if (!context) return <main className="marketing-section"><h1>Terms unavailable</h1><Link href="/tenant/account">Back to my account</Link></main>;
  const records = await db.studentTermsAcceptance.findMany({ where: { organizationId: session.organizationId, studentId: session.studentId }, orderBy: { acceptedAt: "desc" }, take: 100 });
  const current = context.occupancy ? records.find(r => r.occupancyId === context.occupancy!.id && r.version === TERMS_VERSION) : null;
  const s = context.snapshot;
  return <main className="marketing-section"><Link href="/tenant/account">Back to my account</Link><h1>Hostel rules and accommodation terms</h1>
    {s ? <><p><strong>{s.hostel.name}</strong> · {s.hostel.phone}<br />{s.hostel.location}</p><p>Terms version {s.version}</p>
    <section className="panel entity-form"><h2>{s.student.name}</h2><p>{s.student.institution} · Admission number: {s.student.admissionNumber}</p><p>Room {s.room} · {s.semester} · {s.semesterStart.slice(0,10)} to {s.semesterEnd.slice(0,10)}</p>
    <p>{s.rentCharges.length ? "Recorded semester rent: " + s.rentCharges.map(c => "KES " + c.amount + " (account due date " + c.dueDate.slice(0,10) + ")").join(" + ") : "Rent has not yet been recorded. Confirm the amount with management."}</p>
    {s.rules.map((r,i) => <section key={r.title}><h3>{i+1}. {r.title}</h3><p>{r.text}</p></section>)}<h3>Student acceptance</h3><p>{s.declaration}</p></section>
    {current ? <p role="status">You have signed this version for this allocation. Download your saved copy below.</p> : <TermsSignForm name={s.student.name} version={s.version} occupancyId={context.occupancy!.id} documentHash={termsHash(s,"",new Date(0),"preview")} />}</> : <p>A reserved or active room allocation is required before you can sign. Contact management. Earlier signed copies remain available below.</p>}
    <section className="panel entity-form"><h2>My signed copies</h2>{records.length ? records.map(r => <p key={r.id}><a href={`/tenant/terms/${r.id}/pdf`}>Download signed terms (PDF)</a><br />{r.reference} · {r.version} · {new Intl.DateTimeFormat("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"}).format(r.acceptedAt)} EAT</p>) : <p>No signed terms yet. Read the terms above, type your full name and tick the agreement box to sign.</p>}</section>
  </main>;
}
