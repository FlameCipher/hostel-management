import Link from "next/link";
import styles from "@/components/arrears-form.module.css";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { termsManager } from "@/lib/hostel-terms/service";
import { TERMS_VERSION } from "@/lib/hostel-terms/policy";
export const dynamic = "force-dynamic";
export const metadata = { title: "Student accommodation terms", robots: { index: false, follow: false } };
export default async function StudentTermsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await requireSession();
  if (!await termsManager(db, session)) return <section className="panel entity-form"><h1>Signed terms unavailable</h1><p>An active MMAMBUGUA HOSTEL owner, admin or manager account is required.</p></section>;
  const search = await searchParams;
  const q = (search.q ?? "").trim().slice(0,100);
  const page = /^\d+$/.test(search.page ?? "") ? Math.max(1, Math.min(10000, Number(search.page))) : 1;
  const where = { organizationId: session.organizationId, status: { in: ["ACTIVE", "RESERVED"] as ("ACTIVE" | "RESERVED")[] }, student: { organizationId: session.organizationId, ...(q ? { fullName: { contains: q, mode: "insensitive" as const } } : {}) } };
  const [total, signed, allocations, history] = await Promise.all([
    db.occupancy.count({ where }),
    db.occupancy.count({ where: { ...where, termsAcceptances: { some: { organizationId: session.organizationId, version: TERMS_VERSION } } } }),
    db.occupancy.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page-1)*50, take:50, include: { student: { select: { fullName:true, portalEnabled:true } }, room: { select: { number:true } }, semester: { select: { name:true } }, termsAcceptances: { where: { organizationId:session.organizationId, version:TERMS_VERSION }, select:{id:true,acceptedAt:true}, take:1 } } }),
    db.studentTermsAcceptance.findMany({where:{organizationId:session.organizationId,...(q?{student:{fullName:{contains:q,mode:"insensitive"}}}:{})},orderBy:{acceptedAt:"desc"},take:50,select:{id:true,reference:true,version:true,acceptedAt:true,student:{select:{fullName:true}}}}),
  ]);
  const url = (p:number)=>`/student-terms?q=${encodeURIComponent(q)}&page=${p}`;
  return <><div className="page-heading-row"><div><p className="eyebrow">Student register</p><h1>Accepted hostel tenants</h1><p>{total} accepted room allocations · {signed} updated terms acknowledged</p></div></div>
    <section className="panel entity-form"><p>Existing students with an active hostel room are automatically shown as accepted tenants. They do not need to reapply because they are new to this system. <strong>Updated terms are a separate acknowledgement</strong>, completed in Tenant portal → Hostel terms; this does not change their tenant status. The new 10% late-payment charge starts only after acknowledgement and the automatic deadline.</p><form><label className="field-group"><span>Find a student</span><input name="q" defaultValue={q} maxLength={100}/></label><button className="primary-button">Search</button></form></section>
    <section className="panel entity-form mt-5"><h2>Current tenants</h2><div className={styles.list}>{allocations.map(o=><article className={styles.tenant} key={o.id}><div className={styles.tenantHeader}><span><strong>{o.student.fullName}</strong><small>Room {o.room.number} · {o.semester.name}</small></span><strong>{o.status==="ACTIVE"?"Accepted tenant":"Accepted reservation"}</strong></div><details><summary>Updated terms and account access</summary><p>{o.termsAcceptances[0]?<a href={`/student-terms/${o.termsAcceptances[0].id}/pdf`}>Updated terms acknowledged — download PDF</a>:"Updated terms: student acknowledgement needed"}</p><p>{o.student.portalEnabled?"Student portal enabled":"Student account needs activation"}</p></details></article>)}</div>{!allocations.length?<p>No matching tenants.</p>:null}<p>Page {page} · {total} matching allocations</p>{page>1?<Link href={url(page-1)}>Previous page</Link>:null}{page*50<total?<Link href={url(page+1)}> Next page</Link>:null}</section>
    <section className="panel entity-form"><h2>Recent accepted or signed records</h2><p>Latest 50 matching records, including earlier semesters. Search by student name to find their copies.</p>{history.map(r=><p key={r.id}>{r.student.fullName} · {r.version}<br/><a href={`/student-terms/${r.id}/pdf`}>Download {r.reference}</a> · {new Intl.DateTimeFormat("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"}).format(r.acceptedAt)} EAT</p>)}{!history.length?<p>No matching signed records yet.</p>:null}</section>
  </>;
}
