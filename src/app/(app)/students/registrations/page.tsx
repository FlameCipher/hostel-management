import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { registrationCountryCode } from "@/lib/tenant-registration";
import {
  activeQueueSummary,groupPendingRegistrations,registrationCandidateTriage,
  registrationTriageLabels,
} from "@/lib/tenant-registration-triage";
import { summarizeTenantReadiness } from "@/lib/tenant-visitor-operations-summary";
import { RegistrationReviewForm } from "@/components/tenant-registration-forms";
import styles from "@/components/resident-services.module.css";

export const dynamic="force-dynamic";

export default async function RegistrationsPage({
  searchParams,
}:{
  searchParams:Promise<{history?:string;page?:string;view?:string;q?:string;property?:string}>;
}){
  const session=await requireSession();
  if(!await residentStaff(db,session,true))return <section className="panel">
    <h1>Tenant registration</h1>
    <p>Only authorized owners, administrators and managers may review identity and activate accounts.</p>
  </section>;
  const params=await searchParams;
  const now=new Date();
  const history=params.history==="1";
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.page??"1",10)||1));
  const view=["all","ready","investigate","repeats"].includes(params.view??"")
    ?params.view!:"all";
  const search=(params.q??"").trim().toLocaleLowerCase().slice(0,90);
  const [properties,requests,students,activeStudents,portalEnabled,
    eligibleForApproval,pendingCount,expiredCount,visitorCount]=await Promise.all([
    db.property.findMany({
      where:{organizationId:session.organizationId,active:true},
      select:{id:true,name:true,countryCode:true},
      orderBy:{name:"asc"},
    }),
    db.tenantRegistration.findMany({
      where:{
        organizationId:session.organizationId,
        status:"PENDING",expiresAt:{gt:now},
      },
      select:{
        id:true,organizationId:true,propertyId:true,fullName:true,phone:true,
        roomNumber:true,createdAt:true,expiresAt:true,status:true,
      },
      orderBy:[{createdAt:"desc"},{id:"desc"}],take:501,
    }),
    db.student.findMany({
      where:{organizationId:session.organizationId,status:"ACTIVE"},
      select:{
        id:true,fullName:true,phone:true,portalEnabled:true,
        portalPasswordHash:true,portalLastLoginAt:true,portalInviteBlocked:true,
        occupancies:{
          where:{organizationId:session.organizationId,status:"ACTIVE"},
          select:{status:true,room:{select:{number:true,propertyId:true}}},
        },
      },
    }),
    db.student.count({where:{organizationId:session.organizationId,status:"ACTIVE"}}),
    db.student.count({where:{organizationId:session.organizationId,status:"ACTIVE",portalEnabled:true}}),
    db.student.count({where:{
      organizationId:session.organizationId,status:"ACTIVE",portalEnabled:false,
      portalPasswordHash:null,portalLastLoginAt:null,portalInviteBlocked:false,
      occupancies:{some:{organizationId:session.organizationId,status:"ACTIVE"}},
    }}),
    db.tenantRegistration.count({where:{
      organizationId:session.organizationId,status:"PENDING",expiresAt:{gt:now},
    }}),
    db.tenantRegistration.count({where:{
      organizationId:session.organizationId,status:"PENDING",expiresAt:{lte:now},
    }}),
    db.visitorRequest.count({where:{organizationId:session.organizationId}}),
  ]);
  const propertyId=properties.some(p=>p.id===params.property)?params.property:undefined;
  const byProperty=new Map(properties.map(p=>[p.id,p]));
  const groups=groupPendingRegistrations(requests.slice(0,500),now);
  const entries=groups.map(group=>{
    const property=byProperty.get(group.latest.propertyId);
    const result=registrationCandidateTriage(
      group,students,registrationCountryCode(property?.countryCode,session.organizationId),
    );
    return {group,result,property};
  });
  const queueMetrics=activeQueueSummary(groups,entries.map(x=>x.result));
  const filtered=entries.filter(entry=>{
    if(propertyId&&entry.group.latest.propertyId!==propertyId)return false;
    if(view==="ready"&&!entry.result.approvable)return false;
    if(view==="investigate"&&entry.result.approvable)return false;
    if(view==="repeats"&&entry.group.attempts.length<2)return false;
    if(!search)return true;
    return [
      entry.group.latest.fullName,entry.group.latest.phone,
      entry.group.latest.roomNumber,entry.property?.name??"",
    ].join(" ").toLocaleLowerCase().includes(search);
  });
  const onPage=filtered.slice((page-1)*20,page*20);
  const readiness=summarizeTenantReadiness({
    activeStudents,portalEnabled,eligibleForApproval,
    pendingRequests:pendingCount,expiredRequests:expiredCount,
    totalVisitorRequests:visitorCount,
  });
  const historyRows=history?await db.tenantRegistration.findMany({
    where:{organizationId:session.organizationId,
      ...(propertyId?{propertyId}:{}),
      status:{in:["APPROVED","REJECTED","SUPERSEDED","EXPIRED"]}},
    select:{id:true,fullName:true,phone:true,roomNumber:true,
      status:true,createdAt:true,reviewedAt:true,
      property:{select:{name:true}}},
    orderBy:[{createdAt:"desc"},{id:"desc"}],
    skip:(page-1)*20,take:21,
  }):[];
  const base=(nextPage:number,nextView=view)=>"?"+
    new URLSearchParams({
      ...(history?{history:"1"}:{view:nextView}),
      page:String(nextPage),
      ...(search?{q:search}:{}),
      ...(propertyId?{property:propertyId}:{}),
    }).toString();
  const fmt=(date:Date)=>date.toLocaleString("en-KE",{
    dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi",
  });
  return <div className={styles.page}>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Tenant accounts · Verified access</p>
        <h1>Student registration approvals</h1>
        <p>Review existing residents, repeated submissions, conflicting phone details and account access without creating a second tenancy.</p>
      </div>
      <div className="heading-actions">
        <Link href="/students" className="secondary-button">Student register</Link>
        <Link href={history?"/students/registrations":"/students/registrations?history=1"}
          className="secondary-button">
          {history?"Pending queue":"Review history"}
        </Link>
      </div>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><div><p>Active residents</p><strong>{readiness.activeStudents}</strong></div></article>
      <article className="compact-stat"><div><p>Accounts enabled</p><strong>{readiness.portalEnabled}</strong></div></article>
      <article className="compact-stat"><div><p>Pending submissions</p><strong>{readiness.pendingRequests}</strong></div></article>
      <article className="compact-stat"><div><p>Distinct review cases</p><strong>{queueMetrics.pendingGroups}</strong></div></article>
    </section>
    <section className={`panel ${styles.card}`}>
      <h2>Verification overview</h2>
      <p><strong>{queueMetrics.readyForIndependentVerification}</strong> cases have one matching existing tenant and are ready for independent identity verification.
        <strong> {queueMetrics.needsInvestigation}</strong> cases need record or phone review.
        <strong> {queueMetrics.repeatSubmissions}</strong> extra submissions have been grouped without deleting any request.
      </p>
      <p>There are {readiness.notYetEnabled} active residents without an enabled portal.
        They must register and be verified before activation.
        {readiness.expiredRequests?" "+readiness.expiredRequests+" expired pending requests require a new submission.":""}
      </p>
      <div className="policy-banner">
        <div><strong>Do not approve solely because the name, phone and room match.</strong>
          <p>Confirm identity in person or using the trusted contact already in the official student record. A different name or room using the same number must be investigated. Activating one request never changes rent or room allocation.</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Link href="/communications/invitations" className="secondary-button">Review account invitations</Link>
        <Link href="/students/guardians" className="secondary-button">Guardian contacts</Link>
        <Link href="/visitors" className="secondary-button">Visitor operations</Link>
      </div>
    </section>
    <section className={`panel ${styles.card}`}>
      <h2>Find registrations</h2>
      <form method="get">
        {history?<input type="hidden" name="history" value="1"/>:null}
        <div className={styles.grid}>
          <label className="field-group"><span>Student name, room or phone</span>
            <input name="q" defaultValue={params.q??""} maxLength={90}
              placeholder="Find existing resident"/>
          </label>
          <label className="field-group"><span>Hostel property</span>
            <select name="property" defaultValue={propertyId??""}>
              <option value="">All my properties</option>
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {!history?<label className="field-group"><span>Review queue</span>
            <select name="view" defaultValue={view}>
              <option value="all">All pending identities</option>
              <option value="ready">Exact match — verification required</option>
              <option value="investigate">Need investigation</option>
              <option value="repeats">Repeat submissions</option>
            </select>
          </label>:null}
        </div>
        <button className="secondary-button" type="submit">Show matching requests</button>
      </form>
    </section>
    {history?<section className={`panel ${styles.card}`}>
      <h2>Reviewed and expired requests</h2>
      {historyRows.length?historyRows.slice(0,20).map(r=><article key={r.id}>
        <strong>{r.fullName} — Room {r.roomNumber}</strong>
        <p>{r.property.name} · {r.status.replaceAll("_"," ")}</p>
        <p className={styles.meta}>Submitted {fmt(r.createdAt)} · {r.reviewedAt?"Reviewed "+fmt(r.reviewedAt):"No completed review recorded"}</p>
      </article>):<p>No historical review results in this view.</p>}
      <nav className={styles.actions}>
        {page>1?<Link href={base(page-1)}>Previous</Link>:null}
        {historyRows.length>20?<Link href={base(page+1)}>Next</Link>:null}
      </nav>
    </section>:<section className={styles.page}>
      {pendingCount>500?<p className={styles.warning}>
        Only the latest 500 submissions are displayed for review. Server-side approval still checks the complete current-phone queue before any activation.
      </p>:null}
      {onPage.length?onPage.map(({group,result,property})=><section key={group.key} className={`panel ${styles.card}`}>
        <div className="page-heading-row">
          <div><p className="eyebrow">{property?.name??"Hostel"} · Room {group.latest.roomNumber}</p>
            <h2>{group.latest.fullName}</h2>
            <p>Registered phone: +{group.latest.phone}</p>
          </div>
          <span className={`status-pill ${result.approvable?"status-partial":"status-maintenance"}`}>
            {result.approvable?"Match found":"Review required"}
          </span>
        </div>
        <p className={styles.meta}>Latest request: {fmt(group.latest.createdAt)} ·
          Valid until {fmt(group.latest.expiresAt)} · {group.attempts.length}
          {" "}submission{group.attempts.length===1?"":"s"} for these details
        </p>
        <p><strong>{registrationTriageLabels[result.reason]}</strong></p>
        {group.phoneConflict?<p className={styles.warning}>
          More than one submitted name or room uses this phone number for this property.
          Do not approve until the conflicting requests have been investigated.
        </p>:null}
        {group.attempts.length>1?<details>
          <summary>Show {group.attempts.length-1} earlier identical attempts</summary>
          {group.attempts.slice(1).map(a=><p key={a.id} className={styles.meta}>
            Submitted {fmt(a.createdAt)} · Awaiting review; cannot be activated ahead of the latest request.
          </p>)}
        </details>:null}
        <RegistrationReviewForm
          id={group.latest.id}
          repeatCount={group.attempts.length}
          candidates={result.approvable?result.matches.map(s=>({id:s.id,label:s.fullName})):[]}
          blockedReason={result.approvable?undefined:registrationTriageLabels[result.reason]}
        />
      </section>):<section className={`panel ${styles.card}`}>
        <h2>No matching requests</h2>
        <p>Clear filters to review other registrations. No account will be activated without an explicit approval.</p>
      </section>}
      <nav className={styles.actions}>
        {page>1?<Link href={base(page-1)}>Previous cases</Link>:null}
        {filtered.length>page*20?<Link href={base(page+1)}>Next cases</Link>:null}
      </nav>
    </section>}
  </div>;
}
