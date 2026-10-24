import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invitationManager, inviteCandidateWhere } from "@/lib/portal-invitations";
import { buildPhoneOnboardingDraft, pendingPhoneClaim, sharedStudentAccountLink, type PhoneOnboardingStay } from "@/lib/phone-onboarding";
import { StudentAccessShare } from "@/components/student-access-share";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mobile resident onboarding", robots: { index: false, follow: false } };

export default async function MobileOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  if (!(await invitationManager(db, session))) {
    return <section className="panel"><h1>Resident onboarding unavailable</h1>
      <p>Only authorized hostel Owners and Administrators may review student contact records.</p></section>;
  }
  const { page: requestedPage } = await searchParams;
  const page = Math.min(1000, Math.max(1, Math.floor(Number(requestedPage) || 1)));
  // One row per eligible existing resident, not one row per invitation.
  // This includes residents with provider-accepted emails who have not activated.
  const where = inviteCandidateWhere(session.organizationId);
  const now = new Date();
  const [all, items, pending, publishedProperties] = await Promise.all([
    db.student.count({ where }),
    db.student.findMany({
      where,
      select: {
        id: true, fullName: true, phone: true, portalEnabled: true,
        portalInvitations: {
          where: { organizationId: session.organizationId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { status: true, usedAt: true, expiresAt: true },
          take: 1,
        },
        occupancies: {
          where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "RESERVED"] as Array<"ACTIVE" | "RESERVED"> }, room: { organizationId: session.organizationId, property: { organizationId: session.organizationId } } },
          select: {
            room: {
              select: {
                number: true,
                property: {
                  select: { id: true, name: true, countryCode: true, customDomain: true, active: true, publicListing: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 21,
    }),
    // Read-only complete current-property phone-claim index, capped to protect
    // approvals and outreach from partial queues. No applicant passwords loaded.
    db.tenantRegistration.findMany({
      where: {
        organizationId: session.organizationId, status: "PENDING",
        expiresAt: { gt: now },
      },
      select: { propertyId: true, phone: true },
      take: 501,
    }),
    db.property.findMany({
      where: { organizationId: session.organizationId, active: true, publicListing: true },
      select: { name: true, customDomain: true, active: true, publicListing: true },
      take: 2,
    }),
  ]);
  const sharedLink=sharedStudentAccountLink(publishedProperties);
  const queueComplete = pending.length <= 500;
  const current = items.slice(0, 20).map(item => {
    const latest = item.portalInvitations[0];
    const status = latest?.status ?? "NO_INVITATION";
    const stays: PhoneOnboardingStay[] = item.occupancies.map(o => ({
      roomNumber: o.room.number, property: o.room.property,
    }));
    // A phone match is only a reason to HOLD outreach. It does not prove
    // that the pending application belongs to this registered student.
    const pendingRegistration = pendingPhoneClaim(
      item.phone,
      item.occupancies.map(o => ({
        propertyId: o.room.property.id, countryCode: o.room.property.countryCode,
      })),
      pending, session.organizationId,
    );
    return {
      ...item, status, invitationExpiresAt: latest?.expiresAt ?? null, pendingRegistration,
      draft: buildPhoneOnboardingDraft({
        status, phone: item.phone,
        accountEligible: !item.portalEnabled,
        pendingRegistration, queueComplete, stays,
      }),
    };
  });
  const ready = current.filter(item => item.draft.ready).length;
  const awaitingReview = current.filter(item => item.pendingRegistration).length;
  const acceptedButInactive = current.filter(item => item.status === "PROVIDER_ACCEPTED").length;
  return <div>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Owner / Admin · Existing residents only</p>
        <h1>Mobile account onboarding</h1>
        <p>Review every eligible inactive resident, including students whose invitation email was accepted but whose account has not been activated.</p>
      </div>
      <Link className="secondary-button no-underline" href="/communications/invitations">
        <ArrowLeft size={17} /> Email invitations
      </Link>
    </div>

    <div className="room-summary-grid mt-5">
      <article className="compact-stat"><div><p>Eligible residents without active portal access</p><strong>{all}</strong></div></article>
      <article className="compact-stat"><div><p>Safe drafts on this page</p><strong>{ready}/{current.length}</strong></div></article>
      <article className="compact-stat"><div><p>Pending phone claims to review on this page</p><strong>{awaitingReview}</strong></div></article>
      <article className="compact-stat"><div><p>Email accepted, portal inactive on this page</p><strong>{acceptedButInactive}</strong></div></article>
    </div>

    <section className="panel mt-5">
      <h2>One link for all existing students</h2>
      {sharedLink ? <StudentAccessShare {...sharedLink}/> : <p>Use the correct published property-specific registration link. A universal hostel link is unavailable when more than one published property or no safe hostname is configured.</p>}
    </section>

    <section className="panel mt-5">
      <h2><ShieldCheck size={19} aria-hidden="true" /> No automatic account activation</h2>
      <p>These are personal WhatsApp drafts, not sent messages. Confirm the intended resident's current number and permission to contact them before pressing Send in your own WhatsApp app. Opening a draft is never recorded as delivered.</p>
      <p>Before preparing any invitation we check active registrations for the same registered phone and property. A match pauses outreach for management review; it does not establish who submitted the request. If the register exceeds 500 entries, all drafts are withheld until the full queue is reviewed.</p>
      <p>Every link goes to that resident's published hostel domain and its public registration page. It contains no password, private activation token, room number or payment balance. The student chooses a password, and management must independently approve the exact name, phone and current room match.</p>
      <div className="heading-actions">
        <Link href="/students/registrations" className="secondary-button">Review registration approvals</Link>
        <Link href="/communications/whatsapp" className="secondary-button">WhatsApp permissions</Link>
      </div>
    </section>

    <section className="panel mt-5">
      <h2>Resident contact review</h2>
      <p>All eligible residents without activated portals are listed once each, regardless of invitation history. Provider acceptance is not email delivery or account activation. Review accepted invitations with the student before any new outreach. Residents with pending phone claims must be verified in the registration queue instead of being asked to register again.</p>
      {!current.length && <p>No currently eligible phone-onboarding candidates in this view.</p>}
      {current.map(item => <article key={item.id} className="panel mt-4">
        <h3>{item.fullName}</h3>
        <p>Invitation: <strong>{item.status.replaceAll("_", " ")}</strong> · Registered phone: {item.phone ?? "Not recorded"}</p>
        {item.status === "PROVIDER_ACCEPTED" ? <p className="muted-note">The email provider accepted an invitation, but this student has not activated their portal. Check with the student before reissuing or contacting them by another channel. {item.invitationExpiresAt ? `Recorded link expiry: ${item.invitationExpiresAt.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}.` : "Invitation expiry is not confirmed."}</p> : null}
        {item.draft.ready ? <>
          <p>Current room: {item.draft.roomNumber} · <strong>{item.draft.host}</strong></p>
          <div className="heading-actions">
            <a className="primary-button" href={item.draft.whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} /> Review WhatsApp draft
            </a>
            <a className="secondary-button" href={item.draft.url} target="_blank" rel="noopener noreferrer">Preview student registration</a>
          </div>
          <small>External WhatsApp opens only when selected; you must personally confirm the recipient and press Send. No delivery status is inferred.</small>
        </> : <p role="status">{item.draft.reason} <Link href={item.pendingRegistration ? "/students/registrations" : item.status === "PROVIDER_ACCEPTED" ? "/communications/invitations" : "/students"}>{item.pendingRegistration ? "Review pending registrations" : item.status === "PROVIDER_ACCEPTED" ? "Review email invitation" : "Check student records"}</Link>.</p>}
      </article>)}
    </section>
    <nav className="heading-actions mt-5" aria-label="Mobile onboarding pages">
      <span>Page {page}</span>
      {page > 1 && <Link className="secondary-button" href={`?page=${page-1}`}>Previous</Link>}
      {items.length > 20 && <Link className="secondary-button" href={`?page=${page+1}`}>Next</Link>}
    </nav>
  </div>;
}
