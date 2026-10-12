# Tenant Access & Visitor Operations — Complete Management Module

## Purpose
Manage the full tenant identity/visitor workflow without bypassing security, creating
duplicate tenancies, changing rent or falsely claiming a guest's physical presence.

## Resident onboarding

- **Student register:** `/students` links to the tenant activation review.
- **Management approval:** `/students/registrations` shows active student and
  portal-enabled counts, eligible residents not yet activated, and pending
  identity requests. The request listing matches exact registered name, verified
  phone and active current room to the student's existing record.
- **Student self-service:** existing residents open their hostel website and use
  `/tenant/register`. Their request uses a time-bound signed ticket and
  password hash, with property and anti-spam controls.
- **Authentication:** management must verify identity independently before
  approving. No automatic account creation, account reset, room allocation,
  or rent collection occurs as a result of publishing this module.
- **Invitations:** existing `/communications/invitations` lets authorized
  management review the invitation lifecycle. Previously enrolled accounts
  must use recovery rather than being silently overwritten.

## Visitor request and security gate

- **Tenant:** `/tenant/visitors` requires active authorized tenant portal
  access and an active accommodation. Student enters visitor name, phone,
  purpose, expected arrival/departure and optional vehicle. Dates are
  interpreted in the hostel's verified local time zone.
- An idempotent request ticket prevents double-submit. An additional check
  rejects overlapping active requests for the same visitor phone and resident.
  The student/hostel row lock makes this check safe against rapid retries.
- **Management and gate:** `/visitors` lists expected, checked-in without
  departure, overdue departures, expired pending visits, and all history.
  Staff may filter by property and visitor/host/room, with summary counts.
- **Entry gate:** a human verifies visitor identity, host and arrival. The
  server checks that the host is still active at the original room, the
  property and student match, the planned window has not expired, and entry
  is no more than one hour early. If the host moved rooms, entry/approval
  is blocked until a new visitor request is created. Staff may decline stale
  requests.
- **Exit gate:** checkout requires previous verified check-in. Impossible
  future or repeated checkout is rejected. Moving to another room after
  a valid check-in does not prevent recording the visitor's verified exit.
- **Audit:** actions keep the actor staff ID, state transition, original
  host room and property, planned window, and observed action time. Audit
  events do not include full identity numbers, access passwords or secrets.
- "Checked in" means an entry was recorded by staff, not proof of ongoing
  physical presence. "Overdue" means the planned departure has passed
  without a recorded, verified exit.

## Monitoring and restrictions

HealthFix adds read-only checks for checked-in visits with overdue exits,
checked-in visits without an arrival timestamp, and checked-out visits
without complete entry/exit timestamps. It does not auto-correct them.

The current landlord has 32 active residents, one tenant portal account
enabled at the time of the module audit, and no stored visitor requests.
The first actual registered tenant/gate interaction must still be tested
on-site by authorized staff. Do not claim that an unperformed real-world
entry/exit test or notification delivery was verified.

## Regression and release gates

The production build runs `test:visitor-operations` and
`test:visitor-requests` in addition to the entire existing hostel suite.
Tests cover gate chronology, moved-host requests, unauthorized and revoked
staff sessions, cross-hostel tenancy scope, expiration and early arrival,
replay check-in/out prevention, active-tenant requirement, local timezone
conversion, overlap detection and no automatic portal activation.

No database migration or bulk changes are included. All existing semester
charges, receipts, student agreements, and historical room dates remain
untouched. Preview must pass Vercel READY before merge and production must
be re-verified after release. No outbound messages are sent by deployment.
