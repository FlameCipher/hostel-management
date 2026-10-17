# MMAMBUGUA HOSTEL — emergency telephone acceptance

## Purpose

Following deployment of direct-dial buttons for owner-supplied **0714 464 701** and **0722 634 013**, an Owner/Admin can now open `/gate-readiness`, place a real call to **each** line from their own phone, record the factual result and see the latest staff-reported check. The application cannot physically call the numbers, monitor call audio, confirm the intended employee answered or establish around-the-clock coverage.

## Workflow

For each hostel line:

1. Use **Call** on an actual Android/iPhone and deliberately complete a real call.
2. Choose the observed outcome: intended responder answered, no answer, wrong recipient or call could not connect.
3. Record a brief factual note about what you actually observed (no student information or passwords).
4. Explicitly confirm you personally performed that call.
5. Submit the result. The system records a timestamped, organization-scoped audit row attributed to the currently authenticated Owner/Admin. The latest result for each line is displayed on refresh.

**Important:** All results are explicitly labeled **self-reported by the manager**, never independently provider-verified. Even a successful test is not proof of 24/7 monitoring. Failures should be followed up before telling students they can reliably depend on a response.

## Security and isolation

- Available **only** for `mama-mbugua-hostel`, and only to authenticated, current Owner/Admin staff accounts with verified session versions.
- Inputs use strict two-line identifiers and enumerated outcomes, note length 10–280 characters and a required personal-test attestation. A compromised/expired manager session or foreign organization cannot submit evidence.
- Records use existing immutable `AuditLog` entries (`HOSTEL_EMERGENCY_CALL_TEST`) without new tables, credentials, payments or student identity changes.
- The results are deliberately **not** fed into `sosReadinessSummary` as automatic approval; no environment flags, SOS submission access or background phone/WhatsApp dispatch is changed.
- All student/public emergency buttons and Kenya 999/112 remain available irrespective of a recorded result.

## Verification

`npm run test:emergency-call-acceptance` checks authorization, cross-hostel isolation, rejection of unconfirmed claims, distinct outcomes, latest evidence, correct phone link UI, and absence of automated tracking/activation. Included in the full build.

A real two-phone exercise with named responders and a witnessed call completion must be performed before advertising emergency services as staffed. The browser/phone dialer cannot provide server-level evidence that a specific person answered a particular call.
