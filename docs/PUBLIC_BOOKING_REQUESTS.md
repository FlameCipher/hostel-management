# Property booking requests

A published property's own hostname exposes `/book`. The shared directory does not accept bookings. The hostname selects the property; posted property and organization identifiers are not trusted. The form lists active room types with remaining places, excluding maintenance/inactive rooms, active or reserved occupants, and returning students' break holds.

Requests store contact details, a preferred move-in date and a reference. They do not allocate a room, create a student, accept accommodation terms or record a payment. Management follows up using the existing registration, allocation and verified-payment modules. No automatic payment gateway or automated delivery is claimed.

Signed forms expire after 30 minutes and bind the property and request identifier. Exact retries return the same reference. Property locking serializes persistence and per-phone/per-property hourly limits; consent and a honeypot are checked. Composite foreign keys enforce the request's property and room-type organization. The private Bookings inbox scopes reads and writes to the signed-in organization. Current active owner/admin/manager access and local session version are checked before status changes. Status audit records contain no student contact details.

Validation: 145 regression tests, TypeScript, targeted ESLint, production webpack build, and an isolated two-application HTTP journey passed. The HTTP journey exercised public submission, reference receipt, duplicate retry, protected inbox, status update, another landlord's read/write denial, cross-property form denial and absence of fabricated payment records. It also repeated the existing account, website and photography flows. No live customer booking or payment was created during verification.

HealthFix now reads booking-request records alongside room allocations. Booking completion and actual payment delivery remain explicitly unprobed.
