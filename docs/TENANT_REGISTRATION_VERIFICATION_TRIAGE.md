# Tenant Registration Verification & Backlog Triage

## Purpose

Help MMAMBUGUA HOSTEL Owner/Admin/Manager review repeat student portal registrations while enforcing independent identity verification. This is **not** a bulk approval or new-tenancy workflow.

## Management screen

`/students/registrations` defaults to all pending applications (up to 500, with approvals disabled if the listing is incomplete). It groups submissions by **hostel property + normalized registered name + international phone number**, preserving each individual application's original submitted room, creation time and expiry. Applicants sharing a name/phone on a different property do not join the same group.

The page distinguishes:
- Exact eligible existing student record: name + canonical phone + active assigned room and property, but human identity still **not verified**
- Submitted room differs from current occupancy
- Known student already has portal access: use sign-in or recovery rather than a second account
- No matching registered student record
- Existing record ineligible (status, previously used account, restricted account or missing active room)
- More than one exact possible match
- Expired request
- Repeated applications and inconsistent claimed room numbers

The comparison uses the same `registrationCountryCode` Kenya-only fallback as the official server approval. International hostel numbers remain country-scoped.

Each application retains its existing **independent confirmation checkbox and individual Approve/Reject action**. The guarded server action rechecks student status, actual current room, phone, name, property ownership, portal eligibility, the pending request status, its expiration and staff permissions in a database transaction. Application grouping never proves the applicant's identity. The review page never displays submitted or saved password hashes; password hashes are checked only on the server.

## Invitation status

The screen distinguishes missing-email and expired invitation records from deliveries. It links to the existing Owner/Admin phone-onboarding and invitation pages. **No bulk messages are sent**, and an opened WhatsApp draft is not marked delivered.

## Current verified MMAMBUGUA backlog (16 Oct 2026)

Read-only figures from Neon:
- 32 active students, 1 enabled tenant portal
- 23 pending registration requests, 12 applicant identity groups
- 11 extra submissions, 7 repeated groups, 2 groups claiming different rooms
- 18 requests with exactly one eligible current student/room match
- 2 requests with identity matched but differing room/account criteria
- 3 with no matching student identity
- 31 unused invitation records: 22 MISSING_EMAIL and 9 EXPIRED, neither set is a successful delivery
- 0 active caretaker user records, 0 recorded visitors

These are **requests**, not necessarily unique verified students. Do not bulk activate residents because many submissions appear legitimate.

## Acceptance steps

1. Owner/Admin opens `/students/registrations`.
2. Each repeated group and conflicting room claim receives individual review.
3. Independently contact the tenant using the number already on file, or verify in person.
4. Choose the correct matching existing resident, confirm identity and approve **that individual request**.
5. Check the tenant's first successful sign-in. Reject stale or fraudulent duplicates only after verifying they do not belong to a valid applicant.
6. Caretaker gate operator account requires a named, authorized employee and must be provisioned through Staff Management; never auto-create one.
7. Existing Room 54/Room 24 rent, payments, receipts, and audit histories must remain unchanged.

## Testing and release

`test:registration-triage` verifies case-insensitive names, Kenyan 0/254 phone equivalence, ambiguous property/room claims, activated/ineligible records, cross-organization separation, repeat groups, expiry, and immutability. Existing signup/approval regression tests continue to run, including Kenya-specific registration phone rules, verification and account protection. Do not merge unless complete Vercel preview is READY; verify the post-deploy production build, backlog counts and protected financial balances.

No schema migration, no automatic approval, no automatic messaging, no payment modification.
