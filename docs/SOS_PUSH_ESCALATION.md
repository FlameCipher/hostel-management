# MMAMBUGUA HOSTEL — Advisory SOS Push Escalation

**Do not activate the restricted student SOS pilot from software testing alone.** It remains controlled by `HOSTEL_SOS_ENABLED` and the configured organization. This change does not create incidents, enable GPS tracking, contact police or change student/finance records.

## Behavior
- Existing signed-in residents may submit SOS only when the separately scoped pilot has been approved. Students retain visible hostel direct-call buttons and Kenya's 999/112.
- Opted-in, authenticated staff receive a generic push job when an OPEN SOS is found for **their organization** within 24 hours. Owner/Admin push subscriptions receive additional distinct advisory reminders at five and fifteen minutes while still OPEN.
- Existing five-minute Vercel delivery cron processes these jobs; delivery can be delayed or fail. A provider's accepted push is recorded as SENT, not as "read", "answered" or "rescued". No 24/7 monitoring is promised.
- Deterministic job keys prevent repeated queuing per staff device and stage. Emergency jobs are processed before ordinary reminders, and each job is rechecked for current active staff authorization, organization scope and unacknowledged status immediately before any send.
- Lock-screen content is intentionally generic, revealing no student, room, notes, location or personal class data. Only the fixed authenticated `/safety` route may open.
- The owner-only operational readiness panel provides counts of opted-in staff devices and push-provider attempts/failures. Staff can voluntarily opt in directly on the SOS page.
- Manual phone escalation is still needed if an alert has remained unacknowledged for five minutes. No unverified emergency phone/SMS automation was added.

## Live acceptance required before turning on student SOS
1. Assign named caretaker/security responders and separate owner/admin escalation coverage; give each worker their own authorized account.
2. Check real staffing coverage, try both hostel emergency phone numbers and train staff on the incident queue.
3. Set up and independently verify VAPID push and the scheduled delivery job. Test an explicitly labelled synthetic SOS on **two real devices**, including offline and denied-permission scenarios.
4. Confirm emergency phone/SMS fallback and provider-delivery evidence, then document response times. Push accepted by a cloud provider does not certify that anyone saw the request.
5. Review Kenyan data-protection, retention and child-safety requirements. No continuous location tracking should be mandated or described as active.

## Validation
Run `npm run test:sos-push`; this suite is included in the build gate. CI readiness and real-device acceptance are **separate** from deployment.
