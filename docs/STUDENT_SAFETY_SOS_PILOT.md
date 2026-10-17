# Student SOS pilot acceptance

SOS is a voluntary student-requested incident report, not 24-hour tracking,
automatic police dispatch, or guaranteed staff response.

## Before enabling
- Pilot intake defaults OFF. Only the configured organization can enable
  `HOSTEL_SOS_ENABLED=true`; default pilot scope is `mama-mbugua-hostel`.
- Name on-call responders with their own authorized staff accounts.
- Test an actual student phone and a separate staff phone with an explicitly
  marked training case. Record real response steps and inspect audit history.
- Verify location permission denied and accepted, 20-second dashboard refresh,
  server errors, weak connectivity and direct 999/112 emergency call links.
- Add reliable authenticated push/SMS/calling escalation and verified delivery
  before describing the feature as continuously monitored.
- Review ODPC requirements, retention, privacy notice and any additional
  protections needed for younger residents.

## Incident privacy
- GPS is requested only when a student opts in during SOS submission.
- There is no background location collection or routine student map.
- Location is hidden after 30 minutes, cleared on incident closure and
  scheduled for redaction after 24 hours by HealthFix daily maintenance.
- A daily maintenance failure can delay coordinate redaction; monitor receipts.
- OPEN means saved, ACKNOWLEDGED means a staff action was recorded, and
  CLOSED means a staff case note was completed. None proves rescue.

## Future phase
Offer voluntary, time-limited student check-ins, with a clear preference
not to share whereabouts. Do not make precise ongoing tracking mandatory.
