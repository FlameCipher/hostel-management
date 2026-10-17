# MMAMBUGUA HOSTEL — Safe staff notification self-test

This module lets an authorized, signed-in staff member on their own published hostel domain request a push **TEST** for their own opted-in device. It is not a student SOS simulation and does not contact police or other staff. The SOS pilot remains separately OFF until real staffing and security-drill acceptance.

1. Staff signs in to their property-specific hostname and opens `/safety`.
2. Staff enables optional notifications using the existing button. Consent must be granted by the phone.
3. Staff taps **Send TEST notification to this phone**.
4. Server validates same-origin request, current staff session and organization, exact published property host, own device cookie/subscription, enabled preference, and existing 10-minute cooldown.
5. A single `SOS_DRILL` job is queued for the existing five-minute background delivery worker; it expires after 15 minutes. The push shows **Hostel notification TEST**, with no student identity, location, or actual emergency claims.
6. Staff confirms whether an actual physical phone notification arrived and opens the authenticated safety page. The fact that a provider accepted a request does not establish that the phone displayed it.

The owner must still test both phone call numbers on separate devices, appoint named responsible responders, organize on-call coverage, and verify real call escalation. No synthetic student is created; no precise student location, rent, occupancy or financial records are changed. This is NOT a production emergency rescue system.

Regressions: `npm run test:sos-drill` (built into `npm run build`). Complete Vercel preview and production acceptance independently.
