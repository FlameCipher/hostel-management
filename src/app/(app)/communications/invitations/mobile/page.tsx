import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invitationManager, inviteCandidateWhere } from "@/lib/portal-invitations";
import { buildPhoneOnboardingDraft, type PhoneOnboardingStay } from "@/lib/phone-onboarding";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mobile resident onboarding", robots: { index: false, follow: false } };
const statuses = ["MISSING_EMAIL", "EXPIRED"];

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
  const where = {
    organizationId: session.organizationId,
    status: { in: statuses },
    usedAt: null,
    student: inviteCandidateWhere(session.organizationId),
  };
  const [all, items] = await Promise.all([
    db.tenantPortalInvitation.count({ where }),
    db.tenantPortalInvitation.findMany({
      where,
      select: {
        id: true, status: true,
        student: {
          select: {
            fullName: true, phone: true, portalEnabled: true,
            occupancies: {
              where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "RESERVED"] as Array<"ACTIVE" | "RESERVED"> }, room: { organizationId: session.organizationId, property: { organizationId: session.organizationId } } },
              select: {
                room: {
                  select: {
                    number: true,
                    property: {
                      select: { name: true, countryCode: true, customDomain: true, active: true, publicListing: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 21,
    }),
  ]);
  const current = items.slice(0, 20).map(item => {
    const stays: PhoneOnboardingStay[] = item.student.occupancies.map(o => ({
      roomNumber: o.room.number, property: o.room.property,
    }));
    return {
      ...item,
      draft: buildPhoneOnboardingDraft({
        status: item.status, phone: item.student.phone,
        accountEligible: !item.student.portalEnabled,
        stays,
      }),
    };
  });
  const ready = current.filter(item => item.draft.ready).length;
  return <div>
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Owner / Admin · Existing residents only</p>
        <h1>Mobile account onboarding</h1>
        <p>Help current students who cannot use an email invitation request secure portal access through their registered phone.</p>
      </div>
      <Link className="secondary-button no-underline" href="/communications/invitations">
        <ArrowLeft size={17} /> Email invitations
      </Link>
    </div>

    <div className="room-summary-grid mt-5">
      <article className="compact-stat"><div><p>Eligible missing or expired email invitations</p><strong>{all}</strong></div></article>
      <article className="compact-stat"><div><p>Safe drafts on this page</p><strong>{ready}/{current.length}</strong></div></article>
    </div>

    <section className="panel mt-5">
      <h2><ShieldCheck size={19} aria-hidden="true" /> No automatic account activation</h2>
      <p>These are personal WhatsApp drafts, not sent messages. Confirm the intended resident's current number and permission to contact them before pressing Send in your own WhatsApp app. Opening a draft is never recorded as delivered.</p>
      <p>Every link goes to that resident's published hostel domain and its public registration page. It contains no password, private activation token, room number or payment balance. The student chooses a password, and management must independently approve the exact name, phone and current room match.</p>
      <div className="heading-actions">
        <Link href="/students/registrations" className="secondary-button">Review registration approvals</Link>
        <Link href="/communications/whatsapp" className="secondary-button">WhatsApp permissions</Link>
      </div>
    </section>

    <section className="panel mt-5">
      <h2>Resident contact review</h2>
      <p>Only missing-email or expired invitations are included. Provider-accepted, pending and already activated invitations are intentionally excluded to reduce duplicate contact.</p>
      {!current.length && <p>No currently eligible phone-onboarding candidates in this view.</p>}
      {current.map(item => <article key={item.id} className="panel mt-4">
        <h3>{item.student.fullName}</h3>
        <p>Invitation: <strong>{item.status.replaceAll("_", " ")}</strong> · Registered phone: {item.student.phone ?? "Not recorded"}</p>
        {item.draft.ready ? <>
          <p>Current room: {item.draft.roomNumber} · <strong>{item.draft.host}</strong></p>
          <div className="heading-actions">
            <a className="primary-button" href={item.draft.whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} /> Review WhatsApp draft
            </a>
            <a className="secondary-button" href={item.draft.url} target="_blank" rel="noopener noreferrer">Preview student registration</a>
          </div>
          <small>External WhatsApp opens only when selected; you must personally confirm the recipient and press Send. No delivery status is inferred.</small>
        </> : <p role="status">{item.draft.reason} <Link href="/students">Check student records</Link>.</p>}
      </article>)}
    </section>
    <nav className="heading-actions mt-5" aria-label="Mobile onboarding pages">
      <span>Page {page}</span>
      {page > 1 && <Link className="secondary-button" href={`?page=${page-1}`}>Previous</Link>}
      {items.length > 20 && <Link className="secondary-button" href={`?page=${page+1}`}>Next</Link>}
    </nav>
  </div>;
}
