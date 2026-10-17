import { HostelEmergencyCallLinks } from "@/components/hostel-emergency-call-links";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck, UserPlus, Users, ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { gateReadinessSummary } from "@/lib/gate-readiness";
import { whatsappQueueSummary } from "@/lib/whatsapp-queue-summary";
import { staffMayReviewGateReadiness } from "@/lib/staff-navigation-policy";
import { sosPilotEnabled } from "@/lib/student-safety";
import { sosReadinessSummary } from "@/lib/sos-readiness";

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
    db.student.count({where:{organizationId,status:"ACTIVE",portalEnabled:true,portalPasswordHash:{not:null}}}),
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
  // This is a read-only operational summary, not permission to activate,
  // notify, or record physical presence on behalf of a resident.
  const [inviteStatuses,whatsAppStatuses,providerStatuses,sosOpen,sosUnacknowledged,oldestSOS,lastSOSAcknowledgement,staffPushDevices,sosPushAccepted,sosPushFailed]=await Promise.all([
    db.tenantPortalInvitation.groupBy({
      by:["status"],where:{organizationId,usedAt:null},_count:{_all:true},
    }),
    db.notification.groupBy({
      by:["status"],where:{organizationId,channel:"WHATSAPP"},_count:{_all:true},
    }),
    db.whatsAppDelivery.groupBy({
      by:["status"],where:{organizationId},_count:{_all:true},
    }),
    db.safetyAlert.count({where:{organizationId,status:{in:["OPEN","ACKNOWLEDGED"]}}}),
    db.safetyAlert.count({where:{organizationId,status:"OPEN"}}),
    db.safetyAlert.findFirst({where:{organizationId,status:"OPEN"},orderBy:{createdAt:"asc"},select:{createdAt:true}}),
    db.safetyAlert.findFirst({where:{organizationId,acknowledgedAt:{not:null}},orderBy:{acknowledgedAt:"desc"},select:{acknowledgedAt:true}}),
    db.pushSubscription.count({where:{organizationId,audience:"staff",enabled:true}}),
    db.pushDelivery.count({where:{kind:"SOS_ALERT",status:"SENT",subscription:{organizationId}}}),
    db.pushDelivery.count({where:{kind:"SOS_ALERT",status:"FAILED",subscription:{organizationId}}}),
  ]);
  const inviteCount=(status:string)=>inviteStatuses.find(r=>r.status===status)?._count._all??0;
  const whatsapp=whatsappQueueSummary(whatsAppStatuses,providerStatuses);
  const safety=sosReadinessSummary({
    pilotEnabled:sosPilotEnabled(organizationId),
    activeStudents,enabledTenantPortals:enabledTenantAccounts,activeCaretakers,
    activeOwnersAndAdmins:activeOwners+activeAdministrators,
    activeProperties,openAlerts:sosOpen,unacknowledgedAlerts:sosUnacknowledged,
    oldestUnacknowledgedMinutes:oldestSOS?Math.max(0,(Date.now()-oldestSOS.createdAt.getTime())/60000):null,
    lastResponseEvidence:lastSOSAcknowledgement?.acknowledgedAt??null,
  });
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
    <section className="panel mt-5" aria-label="Hostel activation overview">
      <h2>What remains to activate</h2>
      <p><strong>{counts.missingPortal} active students still lack enabled portals.</strong> {counts.pendingRegistrations} pending registration submissions require individual identity checking; repeat submissions are not unique residents.</p>
      <p><strong>{inviteCount("MISSING_EMAIL")} invitation records lack usable email</strong> and {inviteCount("EXPIRED")} have expired. Invitation records are not evidence of delivered notices. Check existing pending registrations before contacting students again.</p>
      <p><strong>WhatsApp:</strong> {whatsapp.queued} queued drafts, {whatsapp.openedUnconfirmed} opened without confirmed sending, and {whatsapp.providerConfirmed} provider delivery/read records. A saved or manually opened draft is not confirmed delivery.</p>
      <p><strong>Gate:</strong> {counts.activeCaretakers} active caretaker users, {counts.recordedEntries} recorded entries and {counts.recordedExits} recorded departures. Actual gate acceptance requires a named staff member and real visitor verification.</p>
      <div className="heading-actions">
        <Link href="/students/registrations" className="secondary-button">Review tenant registrations</Link>
        <Link href="/communications/invitations/mobile" className="secondary-button">Review phone onboarding</Link>
        <Link href="/communications/whatsapp" className="secondary-button">WhatsApp follow-up</Link>
        <Link href="/assistant" className="secondary-button">Ask hostel assistant</Link>
      </div>
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
    <HostelEmergencyCallLinks organizationId={organizationId}/>
    <section className="panel mt-5" aria-label="SOS emergency response operational readiness">
      <div className="panel-heading"><div><p className="panel-kicker">Emergency safety · Owner readiness</p>
        <h2>Student SOS response — operational acceptance</h2>
        <p>{safety.summary}</p></div><ShieldCheck size={22}/></div>
      <div className="room-summary-grid">
        <article className="compact-stat"><div><p>SOS pilot flag</p><strong>{safety.status==="PILOT_OFF"?"OFF":"ON · Unverified"}</strong></div></article>
        <article className="compact-stat"><div><p>Active staff caretaker accounts</p><strong>{safety.caretaker}</strong></div></article>
        <article className="compact-stat"><div><p>Student portal access</p><strong>{safety.portals}/{safety.activeStudents}</strong></div></article>
        <article className="compact-stat"><div><p>Unacknowledged SOS cases</p><strong>{safety.unacknowledged}</strong></div></article>
      </div>
      <p className="muted-note"><strong>Best-effort SOS push evidence:</strong> {staffPushDevices} opted-in staff subscriptions; {sosPushAccepted} provider-accepted SOS jobs; {sosPushFailed} failed SOS jobs. Counts are not distinct incidents, phone-delivery receipts or proof someone answered. Scheduled processing runs approximately every five minutes. For urgent cases call the student and designated staff directly.</p>
      <p className="muted-note">SOS is a restricted software pilot, not a 24/7 security service. Student opt-in to location remains voluntary. No ongoing tracking or police dispatch is active through this panel. A staff account does not prove a staffed emergency shift.</p>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Critical readiness check</th><th>Evidence status</th><th>Next step</th></tr></thead>
        <tbody>{safety.checks.map(check=><tr key={check.code}>
          <td><strong>{check.title}</strong><small className="table-subtext">{check.detail}</small></td>
          <td>{check.status==="RECORDED"?"Recorded (not a drill)":check.status==="ACTION_REQUIRED"?"Action required":"Needs independent verification"}</td>
          <td><Link href={check.href} className="table-action">Review</Link></td>
        </tr>)}</tbody>
      </table></div>
      <div className="heading-actions">
        <Link href="/safety" className="primary-button no-underline">Open protected SOS response queue</Link>
        <Link href="/students/registrations" className="secondary-button">Verify existing tenants</Link>
        <Link href="/users/new?role=CARETAKER" className="secondary-button">Provision real gate staff</Link>
      </div>
      <p className="muted-note">This page is read-only. It does not enable SOS, page a responder, send messages or record an incident. For immediate danger, use real emergency services, including <a href="tel:999">999</a> or <a href="tel:112">112</a> where available.</p>
    </section>
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
