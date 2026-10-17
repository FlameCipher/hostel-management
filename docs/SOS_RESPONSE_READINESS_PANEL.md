# Student SOS — owner operational readiness

This feature gives the authorized Owner/Admin a **read-only** evidence panel within `/gate-readiness`. It does not turn SOS on, register students, change money, mark incidents acknowledged, publish personal location, or contact emergency services.

## What the panel verifies from this hostel's actual records

- SOS pilot flag is configured OFF or ON for this organization (ON **does not mean the hostel is ready**).
- Count of active caretaker accounts and owner/admin users. An account is **not** proof of staff being on call, trained, signed in or able to respond physically.
- Count of active students with activated portals versus the active student register. Students without access cannot use signed-in SOS; physical emergency phone numbers remain vital.
- Current open and unacknowledged SOS records with oldest unacknowledged age. Unacknowledged cases always require human attention and old ones require urgent escalation.
- An authenticated acknowledgement receipt can exist but **does not** establish a passing physical phone-to-response drill, notification delivery, staffing or rescue. Reliable notification escalation and drill acceptance are deliberately still classified `NOT_VERIFIED`.

## Mandatory real-world acceptance outside software

1. Owner nominates responders, records coverage and gives each their own staff account.
2. Owner/responder complete an explicitly marked safety exercise on separate physical student and staff devices. Verify optional location consent, permission denied, offline conditions, caller phone and incident queue.
3. Validate actual authenticated push, phone/SMS and failure escalation before advertising any always-on alert. The existing 20-second visible-page refresh is **not** emergency-grade delivery.
4. Check emergency numbers, location privacy and any ODPC/child-safety obligations. SOS coordinates are only optional, time-limited and never background-tracked.
5. Review the responder playbook and train the nominated staff. Do **not** activate the pilot or promise around-the-clock monitoring based on software tests.

## Regression

`npm run test:sos-readiness` checks that enabling a feature flag or creating an account is never interpreted as live rescue readiness. It also tests portal access gaps, SOS backlog escalation, no implied student safety, counters bounded by valid totals, and verified authentication/data-access boundaries. The production `npm run build` includes this suite.

A green Vercel build confirms tested software behavior, **not** a real emergency response.
