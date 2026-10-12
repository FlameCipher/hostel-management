# Mobile Resident Account Onboarding — complete Owner/Admin module

## Problem solved
Some real existing tenants have registered mobile numbers but lack valid email addresses. Email invitations therefore remain `MISSING_EMAIL`; other invitations expire after 72 hours. These residents must still be able to request access to their existing tenant portal **without adding a fake email address, sharing a management login, fabricating acceptance or overriding their current rental records**.

As of the live read-only baseline on 12 October 2026, the MMAMBUGUA HOSTEL organization reported 32 active students, one portal-enabled account, 22 missing-email invitation records and eight expired invitation records. These are a point-in-time snapshot, not hard-coded figures. Real contact permissions must be checked.

## Complete management workflow

1. An active OWNER or ADMIN opens `/communications/invitations` → **Mobile onboarding** at `/communications/invitations/mobile`. Server-side `invitationManager` rechecks the current active user and organization role; tenants, caretakers, inactive employees, other organizations and anonymous users cannot inspect these records.
2. The page selects **only** current eligible active or reserved residents with a matching active tenancy, no portal account, no old portal password or prior portal login, and no explicit portal access block. It reviews unconsumed `MISSING_EMAIL` or `EXPIRED` invitations. Provider-accepted, already activated and uncertain-send records are excluded to avoid duplicating those outreach attempts.
3. Every prospective draft is checked against exactly one current organization-matched stay, a published and active property, a safe `*.studentshostels.com` hostname, and a syntactically valid registered mobile number with the property country code. Missing, ambiguous or invalid data blocks that draft and routes management back to the student register.
4. The approved link is the hostel's public `/tenant/register` page. The WhatsApp template mentions the property and the tenant's need to enter their real registered name, current room, phone and chosen password. **No private activation token, account ID, room number, ledger amount, password, receipt, guardian identity or PIN** is embedded in the message.
5. Management checks that this is still the intended person, confirms legitimate permission to contact them, clicks **Review WhatsApp draft**, then personally presses **Send** in WhatsApp. Opening the browser draft does not send a message and does not mark it sent/delivered in the hostel database. This module does not offer bulk- or auto-send.
6. The student enters their own data/password. The existing public registration path only creates a pending request. Management reviews it under `/students/registrations` and independently matches the existing full name, registered mobile and current room before enabling access. No new tenancy, rental adjustment or replacement of an existing password is allowed.

The public registration URL may also be communicated in person or via an authorized hostel group announcement without a WhatsApp draft. It grants **no account access** until owner/admin verification.

## Operational and security gates

- Do not manually fill in a student's email or create a caretaker account without independently verified details.
- Do not broadcast private activation links or group-share individualized invitation URLs.
- Do not use the fact that a draft opened as proof of delivery, reading, student consent, physical occupancy or successful login.
- Owner/admin should use the existing WhatsApp permission interface to record explicit permission for automatic business-initiated messaging. Auto-WhatsApp remains dependent on provider setup and that permission.
- Editing a phone number, student name or room allocation is a separate audited management decision; this module never mutates them.
- No database migrations, outbound provider API calls, session changes, new accounts, rent adjustments, receipts or payment writes happen during deployment or page load.

## Tests and launch acceptance

`npm run test:phone-onboarding` covers correct Kenyan number normalization, property host isolation, expired public-link fallback, exclusion of already accepted/activated invitations, multiple/zero room stays, invalid phone/country, inactive/unpublished properties, and template safety. It runs inside the established production build test chain, alongside session/tenant-isolation, invitation, communication and visitor tests.

Before live use, Owner/Admin checks the page on their own phone, confirms an existing authorized resident's actual contact details and consent, manually opens a draft without sending until ready, and ensures the student's request remains pending until identity is checked. No artificial test phone/email or messages to real residents should be generated solely to demonstrate a pass.

## Separate recovery and provider issues

Email delivery remains a provider action whose acceptance is not the same as inbox delivery. Database-backup read-back/restore readiness must be assessed separately from this portal onboarding; it is not implied by safe WhatsApp drafts.
