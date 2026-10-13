# Existing MMAMBUGUA HOSTEL resident account — easy two-step registration

## Scope

This page is **only** for people whose student tenancy already exists in the hostel register and who want a student portal account. It is not a fresh hostel booking, additional tenancy, rent charge, student creation or public financial lookup.

## Mobile flow

1. Open the hostel-specific https://mmambugua.studentshostels.com/tenant/register link.
2. **My hostel details:** enter full registered name, mobile number already given to management and current room number; tap Continue. Use a normal Kenyan 07 or 01 format when the configured hostel country is Kenya, or +254. All three are required and client-validated before continuing.
3. **Set password:** create password (minimum 10 characters, limited to 72 UTF-8 bytes by the server) and repeat it; check the identity confirmation box; tap Submit registration.
4. **Request received:** student sees a plain approval-pending confirmation, student sign-in link and optional app install details. The button does not activate the account or accept payment.
5. Management sees this request under /students/registrations. An exact unique candidate is preselected to reduce clicks, but approval still requires the manager to independently verify identity using contact already on file and explicitly check the verification box. Missing matches cannot be activated.

## Security retained

- The request must originate from the hostel's published property-specific hostname. The server validates a short-lived HMAC booking ticket, fingerprint rate limits, property scope, valid registered international phone and matching password/confirmation.
- Server hashes the password with bcrypt and stores only a pending registration request, never instantly creating or overwriting a student portal account.
- Management's authoritative review service still validates the full registered name, canonical phone number and current active room, checks unclaimed/eligible portal status, prevents takeover of used/blocked accounts and creates an audit record on activation.
- The management UI cannot override review security checks or automatically approve an account because a dropdown happens to have one candidate.
- No migrations or resident data changes are needed for this UX update. Other hostels on the platform retain property-based scoping.

## Test gates and mobile acceptance

The focused test suite `npm run test:existing-tenant-easy-signup` checks two-step rendering, required identity/credential fields, progress gating, linked management verification, pending-only request creation, Kenya phone normalization, bcrypt hashing, expiry, and pre-DB rejection of invalid credentials. The full Vercel production build includes the suite.

A real student and authorized manager should complete a genuine request on their own phones to confirm the account cannot be accessed until approved; then sign in and check that only their own room and statements display. CI passing is not the same as real identity and device acceptance.
