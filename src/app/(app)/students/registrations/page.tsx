import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { registrationCountryCode } from "@/lib/tenant-registration";
import {
  triageTenantRegistrations,registrationReviewLabels,
  type ReviewRegistration,type RegisteredTenant,
} from "@/lib/tenant-registration-triage";
import { RegistrationReviewForm } from "@/components/tenant-registration-forms";
import styles from "@/components/resident-services.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Tenant registration verification",robots:{index:false,follow:false}};

export default async function RegistrationsPage({
  searchParams,
}:{searchParams:Promise<{page?:string;history?:string;q?:string}>}){
  const session=await requireSession();
  if(!(await residentStaff(db,session,true)))return <section className="panel">
    <h1>Tenant verification unavailable</h1>
    <p>Only authenticated hostel Owners, Admins and Managers can review student access requests.</p>
  </section>;
  const params=await searchParams;
  const history=params.history==="1";
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.page??"1",10)||1));
  const search=(params.q??"").trim().slice(0,80).toLowerCase();
  const now=new Date();

  const [pending,allPending,properties,students,activeStudents,portalEnabled,
    pendingInvitations,historyItems,eligibleStudents]=await Promise.all([
    db.tenantRegistration.findMany({
      where:{organizationId:session.organizationId,status:"PENDING"},
      orderBy:[{createdAt:"desc"},{id:"desc"}],take:501,
      select:{id:true,organizationId:true,propertyId:true,fullName:true,
        phone:true,roomNumber:true,createdAt:true,expiresAt:true,status:true},
    }),
    db.tenantRegistration.count({where:{organizationId:session.organizationId,status:"PENDING"}}),
    db.property.findMany({where:{organizationId:session.organizationId},
      select:{id:true,name:true,countryCode:true,active:true}}),
    db.student.findMany({
      where:{organizationId:session.organizationId},
      select:{
        id:true,organizationId:true,fullName:true,phone:true,status:true,
        portalEnabled:true,portalPasswordHash:true,portalLastLoginAt:true,
        portalInviteBlocked:true,
        occupancies:{where:{organizationId:session.organizationId,status:"ACTIVE"},
          select:{status:true,room:{select:{number:true,propertyId:true}}}},
      },
    }),
    db.student.count({where:{organizationId:session.organizationId,status:"ACTIVE"}}),
    db.student.count({where:{organizationId:session.organizationId,status:"ACTIVE",portalEnabled:true}}),
    db.tenantPortalInvitation.groupBy({
      by:["status"],where:{organizationId:session.organizationId,usedAt:null},
      _count:{_all:true},
    }),
    history?db.tenantRegistration.findMany({
      where:{organizationId:session.organizationId,status:{not:"PENDING"}},
      orderBy:[{createdAt:"desc"},{id:"desc"}],take:21,skip:(page-1)*20,
      select:{id:true,fullName:true,phone:true,roomNumber:true,status:true,
        createdAt:true,reviewedAt:true,expiresAt:true,
        property:{select:{name:true}}},
    }):Promise.resolve([]),
    db.student.count({where:{
      organizationId:session.organizationId,status:"ACTIVE",
      portalEnabled:false,portalPasswordHash:null,portalLastLoginAt:null,
      portalInviteBlocked:false,
      occupancies:{some:{organizationId:session.organizationId,status:"ACTIVE"}},
    }}),
  ]);

  const countryByProperty=new Map(properties.map(p=>[
    p.id,registrationCountryCode(p.countryCode,session.organizationId),
  ]));
  const triage=triageTenantRegistrations(
    pending as ReviewRegistration[],
    students as RegisteredTenant[],
    propertyId=>countryByProperty.get(propertyId)??null,now,
  );
  const propertyById=new Map(properties.map(p=>[p.id,p]));
  const groups=triage.groups.filter(g=>!search||
    [g.fullName,g.phone,...g.rooms,propertyById.get(g.propertyId)?.name??""]
      .join(" ").toLowerCase().includes(search));
  const first=groups.slice(0,500);
  const missingEmail=pendingInvitations.find(r=>r.status==="MISSING_EMAIL")?._count._all??0;
  const expiredEmail=pendingInvitations.find(r=>r.status==="EXPIRED")?._count._all??0;
  const historyPage=historyItems.slice(0,20);
  const complete=pending.length===allPending&&pending.length<=500;

  return <div className={styles.page}>
    <div className="page-heading-row">
      <div><p className="eyebrow">Existing tenants · Identity verification</p>
        <h1>Tenant registration review</h1>
        <p>Grouped applications, duplicate warnings and independent resident approval.</p>
      </div>
      <div className="heading-actions">
        <Link href="/students" className="secondary-button">Student register</Link>
        <Link href={history?"/students/registrations":"/students/registrations?history=1"}
          className="secondary-button">{history?"Pending requests":"Reviewed history"}</Link>
      </div>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><div><p>Active residents</p><strong>{activeStudents}</strong></div></article>
      <article className="compact-stat"><div><p>Tenant portals enabled</p><strong>{portalEnabled}</strong></div></article>
      <article className="compact-stat"><div><p>Pending applications</p><strong>{allPending}</strong></div></article>
      <article className="compact-stat"><div><p>Applicant identity groups</p><strong>{triage.counts.identities}</strong></div></article>
    </section>

    <section className={`panel ${styles.card} mt-5`}>
      <h2>Approval readiness</h2>
      <p><strong>{triage.counts.exactEligible}</strong> requests match one eligible registered name, phone and active room;
        <strong> {triage.counts.blocked}</strong> require additional identity or room review.
        Exact matching does not replace in-person or independent verification.</p>
      <p><strong>{triage.counts.repeatSubmissions}</strong> extra submissions from repeat applicants;
        <strong> {triage.counts.conflictingRooms}</strong> applicant identity groups contain conflicting room claims.</p>
      <p>{eligibleStudents} active resident records meet the existing portal activation prerequisites.
        No account is activated by reviewing this screen.</p>
      {!complete?<p className="form-error" role="alert">The pending register exceeds the reviewed limit.
        Approval recommendations are disabled until the full backlog is reviewed.</p>:null}
      <div className={styles.actions}>
        <Link className="secondary-button" href="/communications/invitations/mobile">
          Review phone onboarding
        </Link>
        <Link className="secondary-button" href="/communications/invitations">
          Review email invitations
        </Link>
      </div>
      <p className={styles.meta}>Invitation records awaiting outreach: {missingEmail} without an email address;
        {" "}{expiredEmail} expired. These records are not evidence of delivered messages.
        Invitation links and self-registration are different routes to the same existing student account.</p>
    </section>

    {history?<section className={`panel ${styles.card} mt-5`}>
      <h2>Reviewed registration history</h2>
      {historyPage.length?historyPage.map(r=><article key={r.id} className="mt-4">
        <strong>{r.fullName}</strong>
        <p>{r.property.name} · Room {r.roomNumber} · {r.status}</p>
        <small>Submitted {r.createdAt.toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi"})}.
          {r.reviewedAt?" Reviewed "+r.reviewedAt.toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi"}):""}</small>
      </article>):<p>No reviewed registration requests yet.</p>}
      <nav className={styles.actions}>
        {page>1?<Link href={"?history=1&page="+(page-1)}>Previous</Link>:null}
        {historyItems.length>20?<Link href={"?history=1&page="+(page+1)}>Next</Link>:null}
      </nav>
    </section>:<>
      <section className={`panel ${styles.card} mt-5`}>
        <h2>Pending applicant groups</h2>
        <form method="get" className="filter-bar student-filter-bar">
          <label className="filter-search"><span>Search</span>
            <input name="q" defaultValue={params.q??""} maxLength={80}
              placeholder="Student, phone, property or room" aria-label="Search applicants"/>
          </label>
          <button className="secondary-button" type="submit">Filter applications</button>
        </form>
        <p>Review one existing student identity at a time. A repeated submission is not a separate resident,
          and claiming different rooms requires particular care. No bulk approval is available.</p>
      </section>
      {first.map(g=><section key={g.key} className={`panel ${styles.card} mt-4`}>
        <h2>{g.fullName}</h2>
        <p><strong>{propertyById.get(g.propertyId)?.name??"Hostel"}</strong> · {g.phone}
          {" · "}{g.submissions.length} application{g.submissions.length===1?"":"s"}</p>
        {g.submissions.length>1?<p className={styles.warning}>
          Repeat applications from this identity. Check which one was submitted by the verified tenant.
          Different passwords may have been chosen; approving one must not approve the others.
        </p>:null}
        {g.conflictingRooms?<p className={styles.warning}>
          <strong>Conflicting room claims:</strong> {g.rooms.join(", ")}.
          Confirm the room presently assigned in the student register before proceeding.
        </p>:null}
        {g.submissions.map((entry,index)=>{
          const r=entry.request;
          const candidates=complete&&entry.kind==="EXACT_MATCH"?
            students.filter(s=>entry.matchingStudentIds.includes(s.id))
              .map(s=>({id:s.id,label:s.fullName})):[];
          return <article key={r.id} className="mt-4">
            <h3>Application {index+1} · Room {r.roomNumber}</h3>
            <p>{registrationReviewLabels[entry.kind]}</p>
            <small>Submitted {r.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})};
              expires {r.expiresAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}</small>
            {!complete?<p className={styles.warning}>This is a partial register.
                Review all pending applications before activation.</p>:null}
            <RegistrationReviewForm id={r.id} candidates={candidates}/>
          </article>;
        })}
      </section>)}
      {!groups.length?<section className={`panel ${styles.card} mt-4`}>
        <p>No matching pending applications.</p>
      </section>:null}
    </>}
  </div>;
}
