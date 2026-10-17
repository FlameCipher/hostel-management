import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { registrationCountryCode } from "@/lib/tenant-registration";
import { registeredResidentCallTarget } from "@/lib/tenant-verification-contact";
import {
  triageTenantRegistrations,registrationReviewLabels,
  registrationCaseKind,registrationCaseLabels,activationOutreachSummary,registrationExpiryPriority,type RegistrationCaseKind,
  type ReviewRegistration,type RegisteredTenant,
} from "@/lib/tenant-registration-triage";
import { RegistrationReviewForm } from "@/components/tenant-registration-forms";
import styles from "@/components/resident-services.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Tenant registration verification",robots:{index:false,follow:false}};

export default async function RegistrationsPage({
  searchParams,
}:{searchParams:Promise<{page?:string;history?:string;q?:string;focus?:string;urgency?:string}>}){
  const session=await requireSession();
  if(!(await residentStaff(db,session,true)))return <section className="panel">
    <h1>Tenant verification unavailable</h1>
    <p>Only authenticated hostel Owners, Admins and Managers can review student access requests.</p>
  </section>;
  const params=await searchParams;
  const history=params.history==="1";
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.page??"1",10)||1));
  const search=(params.q??"").trim().slice(0,80).toLowerCase();
  const focusOptions=["VERIFY_IDENTITY","CONFLICT","RECORD_REVIEW","EXISTING_ACCOUNT","EXPIRED"];
  const focus:RegistrationCaseKind|"ALL"=focusOptions.includes(params.focus??"")
    ? params.focus as RegistrationCaseKind:"ALL";
  const now=new Date();
  const urgency=params.urgency==="SOON"?"SOON":"ALL";

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
  const outreach=activationOutreachSummary(
    session.organizationId,triage.groups,students as RegisteredTenant[],
    propertyId=>countryByProperty.get(propertyId)??null,now,
  );
  const groups=triage.groups.filter(g=>
    (focus==="ALL" || registrationCaseKind(g)===focus) &&
    (urgency==="ALL" || registrationExpiryPriority(g,now)==="URGENT") &&
    (!search || [g.fullName,g.phone,...g.rooms,propertyById.get(g.propertyId)?.name??""]
      .join(" ").toLowerCase().includes(search))).sort((a,b)=>{
        const aPriority=registrationExpiryPriority(a,now)==="URGENT"?0:1;
        const bPriority=registrationExpiryPriority(b,now)==="URGENT"?0:1;
        return aPriority-bPriority ||
          a.submissions[0].request.expiresAt.getTime()-b.submissions[0].request.expiresAt.getTime() ||
          b.latest.getTime()-a.latest.getTime();
      });
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
        <strong> {triage.counts.conflictingRooms}</strong> applicant groups contain conflicting room claims;
        <strong> {triage.counts.conflictingPhoneGroups}</strong> groups share a phone with a different registered name.</p>
      {complete?<section aria-label="Existing tenant activation work queue">
        <h3>Resident activation work queue</h3>
        <p><strong>{outreach.pendingPhoneClaims} eligible resident records already have pending phone claims.</strong>
          Verify those applications against the existing hostel register before activating accounts.
          A matching phone number does not prove the applicant's identity.</p>
        <p><strong>{outreach.needsContactReview} eligible resident records have no currently pending claim
          on their registered phone for this hostel property.</strong> Review these residents for individual
          onboarding contact; do not automatically send repeat invitations.
          {outreach.invalidPhoneOrRoom>0?` ${outreach.invalidPhoneOrRoom} additional record(s) need phone or room verification before contact.`:""}</p>
        <p><strong>{outreach.expiringCases} applicant cases have their latest request expiring within four days.</strong>
          {outreach.earliestExpiry?` Earliest latest-request expiry: ${outreach.earliestExpiry.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}.`:""}
          Review expiring cases before the deadline; an expired registration cannot activate an account.</p>
        <div className={styles.actions}>
          <Link href="/communications/invitations/mobile" className="secondary-button">Review residents needing outreach</Link>
          <Link href="/students/registrations" className="secondary-button">Review all pending requests</Link>
        </div>
        <p className={styles.meta}>These are record-based counts, not independent identity verification,
          delivered messages, or permission for bulk activation. If the pending queue is incomplete,
          do not rely on these figures for outreach.</p>
      </section>:null}
      <h3>Distinct applicant cases requiring management review</h3>
      <p><strong>{triage.caseCounts.verifyIdentity}</strong> cases have a matching current record and can proceed to
        <strong> independent human identity checking</strong> (not automatic approval);
        <strong> {triage.caseCounts.conflicts}</strong> have conflicting claims;
        <strong> {triage.caseCounts.recordReview}</strong> require resident-record review;
        <strong> {triage.caseCounts.existingAccount}</strong> already have a portal account; and
        <strong> {triage.caseCounts.expired}</strong> are expired.</p>
      <p className={styles.meta}>Case totals count people-and-phone groups, not repeat applications.
        A matched student is not an authenticated applicant. No automated approval or rejection takes place.</p>
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
          <label className="field-group"><span>Review priority</span>
            <select name="focus" defaultValue={focus} aria-label="Filter registration cases by priority">
              <option value="ALL">All applicant cases</option>
              <option value="VERIFY_IDENTITY">Identity verification needed ({triage.caseCounts.verifyIdentity})</option>
              <option value="CONFLICT">Conflicting claims ({triage.caseCounts.conflicts})</option>
              <option value="RECORD_REVIEW">Resident record issues ({triage.caseCounts.recordReview})</option>
              <option value="EXISTING_ACCOUNT">Existing portal access ({triage.caseCounts.existingAccount})</option>
              <option value="EXPIRED">Expired ({triage.caseCounts.expired})</option>
            </select>
          </label>
          <label className="field-group"><span>Expiry priority</span>
            <select name="urgency" defaultValue={urgency} aria-label="Filter registration cases by expiry">
              <option value="ALL">All case deadlines</option>
              <option value="SOON">Latest application expires within 4 days</option>
            </select>
          </label>
          <button className="secondary-button" type="submit">Filter applications</button>
        </form>
        <p role="status">Showing {groups.length} of {triage.caseCounts.verifyIdentity+
          triage.caseCounts.conflicts+triage.caseCounts.recordReview+
          triage.caseCounts.existingAccount+triage.caseCounts.expired} distinct applicant cases.</p>
        <p>Review one existing student identity at a time. A repeated submission is not a separate resident,
          and claiming different rooms requires particular care. No bulk approval is available.</p>
      </section>
      {first.map(g=><section key={g.key} className={`panel ${styles.card} mt-4`}>
        <h2>{g.fullName}</h2>
        <p className={styles.meta}><strong>{registrationCaseLabels[registrationCaseKind(g)]}</strong></p>
        <p><strong>{propertyById.get(g.propertyId)?.name??"Hostel"}</strong> · {g.phone}
          {" · "}{g.submissions.length} application{g.submissions.length===1?"":"s"}</p>
        {g.submissions.length>1?<p className={styles.warning}>
          Repeat submissions from this identity. Only the latest application may be approved after independent identity verification. Earlier passwords are invalidated when the valid request is finally approved.
        </p>:null}
        {g.conflictingRooms?<p className={styles.warning}>
          <strong>Conflicting room claims:</strong> {g.rooms.join(", ")}.
          Confirm the room presently assigned in the student register before proceeding.
        </p>:null}
        {g.conflictingPhoneClaims?<p className={styles.warning}>
          <strong>Conflicting identities:</strong> This mobile number also appears on a
          pending request with a different submitted name in the same hostel property.
          Resolve those requests individually before activating either account.
        </p>:null}
        {g.submissions.map((entry,index)=>{
          const r=entry.request;
          const candidates=complete&&entry.kind==="EXACT_MATCH"?
            students.filter(s=>entry.matchingStudentIds.includes(s.id))
              .map(s=>({
                id:s.id,label:s.fullName,
                // This contact comes from the pre-existing Student record,
                // never the number typed into an unverified application.
                registeredContact:registeredResidentCallTarget(
                  s.phone,propertyById.get(g.propertyId)?.countryCode,session.organizationId,
                ),
              })):[];
          return <article key={r.id} className="mt-4">
            <h3>Application {index+1} · Room {r.roomNumber}</h3>
            {index===0 && registrationExpiryPriority(g,now)==="URGENT"?
              <p className={styles.warning} role="status">
                <strong>Priority review:</strong> This latest request expires within four days.
                Verify the applicant independently before approving. Expiry never authorizes automatic activation.
              </p>:null}
            <p>{registrationReviewLabels[entry.kind]}</p>
            <small>Submitted {r.createdAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})};
              expires {r.expiresAt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"})}</small>
            {!complete?<p className={styles.warning}>This is a partial register.
                Review all pending applications before activation.</p>:null}
            <RegistrationReviewForm id={r.id} candidates={candidates}
              blockApproval={
                !complete || index!==0 || g.conflictingRooms ||
                g.conflictingPhoneClaims || entry.kind!=="EXACT_MATCH"
              }
              blockReason={
                !complete?"The pending register is incomplete. Review the full queue.":
                index!==0?"This is an older submitted password. Review only the newest application.":
                g.conflictingRooms?"Different room claims for this same identity must be resolved first.":
                g.conflictingPhoneClaims?"The phone is associated with different submitted identities.":
                entry.kind!=="EXACT_MATCH"?registrationReviewLabels[entry.kind]:
                undefined
              }
            />
          </article>;
        })}
      </section>)}
      {!groups.length?<section className={`panel ${styles.card} mt-4`}>
        <p>No matching pending applications.</p>
      </section>:null}
    </>}
  </div>;
}
