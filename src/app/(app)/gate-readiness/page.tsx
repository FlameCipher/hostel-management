import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck, UserPlus, Users, ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { gateReadinessSummary } from "@/lib/gate-readiness";
import { staffMayReviewGateReadiness } from "@/lib/staff-navigation-policy";

export default async function GateReadinessPage() {
  const session=await requireSession();
  if(!staffMayReviewGateReadiness(session.role))redirect("/visitors");
  const organizationId=session.organizationId;
  const [
    activeCaretakers,activeOwners,activeAdministrators,activeStudents,
    enabledTenantAccounts,pendingRegistrations,expectedVisits,
    recordedEntries,recordedExits,overdueExits,activeProperties,
  ]=await Promise.all([
    db.user.count({where:{organizationId,active:true,role:"CARETAKER"}}),
    db.user.count({where:{organizationId,active:true,role:"OWNER"}}),
    db.user.count({where:{organizationId,active:true,role:"ADMIN"}}),
    db.student.count({where:{organizationId,status:"ACTIVE"}}),
    db.student.count({where:{organizationId,status:"ACTIVE",portalEnabled:true}}),
    db.tenantRegistration.count({where:{
      organizationId,status:"PENDING",expiresAt:{gt:new Date()},
    }}),
    db.visitorRequest.count({where:{
      organizationId,status:{in:["REQUESTED","APPROVED"]},
      expectedDeparture:{gt:new Date()},
    }}),
    db.visitorRequest.count({where:{organizationId,checkedInAt:{not:null}}}),
    db.visitorRequest.count({where:{organizationId,checkedOutAt:{not:null}}}),
    db.visitorRequest.count({where:{
      organizationId,status:"CHECKED_IN",checkedOutAt:null,
      expectedDeparture:{lt:new Date()},
    }}),
    db.property.count({where:{organizationId,active:true}}),
  ]);
  const readiness=gateReadinessSummary({
    activeCaretakers,activeOwners,activeAdministrators,activeStudents,
    enabledTenantAccounts,pendingRegistrations,expectedVisits,
    recordedEntries,recordedExits,overdueExits,activeProperties,
  });
  const counts=readiness.counts;
  return <div>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Owner &amp; Admin · Operational acceptance</p>
        <h1>Gate staff &amp; visitor readiness</h1>
        <p>Complete the operational handover before using the visitor system at the hostel gate.</p>
      </div>
      <Link className="secondary-button no-underline" href="/visitors">
        <ArrowLeft size={17}/> Visitor operations
      </Link>
    </div>
    <section className="room-summary-grid">
      <article className="compact-stat"><div><p>Active gate staff</p><strong>{counts.activeCaretakers}</strong></div></article>
      <article className="compact-stat"><div><p>Enabled tenant accounts</p><strong>{counts.enabledTenantAccounts}/{counts.activeStudents}</strong></div></article>
      <article className="compact-stat"><div><p>Pending registrations</p><strong>{counts.pendingRegistrations}</strong></div></article>
      <article className="compact-stat"><div><p>Departure not verified</p><strong>{counts.overdueExits}</strong></div></article>
    </section>
    <div className="policy-banner mt-5">
      <ShieldCheck size={21}/>
      <div>
        <strong>Software readiness is not proof of an on-site gate test.</strong>
        <p>Only confirmed physical visitor entry/exit and a real authorized employee can
          establish operational acceptance. No test visitor, caretaker account,
          resident activation, gate entry, or communication is created by this page.</p>
      </div>
    </div>
    <section className="panel mt-5">
      <div className="panel-heading">
        <div><p className="panel-kicker">Onboarding and handover</p><h2>Operational acceptance checklist</h2>
          <p>{readiness.pendingVerification} item{readiness.pendingVerification===1?"":"s"} need attention or a real-world check.</p>
        </div><ClipboardCheck size={22}/>
      </div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Gate readiness check</th><th>Assessment</th><th>What to do</th></tr></thead>
        <tbody>{readiness.steps.map(step=><tr key={step.code}>
          <td><strong>{step.title}</strong>
            <small className="table-subtext">{step.explanation}</small></td>
          <td>{step.status==="READY"?"System record present":
            step.status==="ACTION_REQUIRED"?"Action required":"Not independently verified"}</td>
          <td><Link className="table-action" href={step.href}>Review {step.title.toLowerCase()}</Link></td>
        </tr>)}</tbody>
      </table></div>
    </section>
    {readiness.needsGateOperator?<section className="panel mt-5">
      <div className="panel-heading"><div><p className="panel-kicker">Missing staff role</p>
        <h2>Create a named caretaker/security account</h2></div><UserPlus size={21}/></div>
      <p>An Owner/Admin must enter the real employee's name and email, choose the
        CARETAKER / SECURITY role and issue a private temporary password. The
        gate operator must personally sign in and change their password.
        Never use the landlord login at the gate.</p>
      <Link className="primary-button no-underline" href="/users/new?role=CARETAKER">
        <UserPlus size={17}/> Prepare caretaker account
      </Link>
    </section>:null}
    <section className="panel mt-5">
      <div className="panel-heading"><div><p className="panel-kicker">Resident access</p>
        <h2>Activate only verified existing tenants</h2></div><Users size={21}/></div>
      <p>{counts.missingPortal} active residents do not yet have an enabled portal account.
        Direct residents to the hostel's Student sign-in page to request their
        own access. Verify the recorded full name, registered phone and current
        room before approval. Existing passwords and tenancy records are not replaced.</p>
      <Link className="secondary-button no-underline" href="/students/registrations">
        Review resident registrations
      </Link>
    </section>
    <section className="panel mt-5">
      <div className="panel-heading"><div><p className="panel-kicker">Live gate workflow</p>
        <h2>First real visitor acceptance check</h2></div><ClipboardCheck size={21}/></div>
      <p>Ask an authorized tenant to register a genuine visitor, verify host and
        identity in person at the gate, record the actual entry and later the
        verified departure. Do not fabricate records or mark someone checked out
        because a planned time expired.</p>
      <div className="heading-actions">
        <Link className="secondary-button no-underline" href="/visitors?filter=EXPECTED">
          Expected visitors
        </Link>
        <Link className="secondary-button no-underline" href="/visitors?filter=OVERDUE">
          Review overdue departures
        </Link>
        <Link className="secondary-button no-underline" href="/healthfix">
          HealthFix checks
        </Link>
      </div>
    </section>
  </div>;
}
