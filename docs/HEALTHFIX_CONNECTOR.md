# Hostel HealthFix v2

Management opens `/healthfix`. Only active database OWNER/ADMIN users can read this scoped console or run its repair action. Existing theme classes are reused. Every manual repair rechecks access inside its transaction. The daily cron authenticates with CRON_SECRET and runs safe maintenance before communications/invitations. The read-only connector at `GET /api/platform/healthfix` authenticates with separate HEALTHFIX_CONNECTOR_SECRET; it cannot run repairs.

Checks cover endpoint execution, database reads, session/provisioning/email/cron configuration, room allocations, charge/payment table access, terms, tenant communications/conversations and invitations. Queue warnings detect interrupted sends (15 minutes), unresolved FAILED/REVIEW/MISSING_EMAIL records, due notice/invitation backlogs (26 hours) and recorded receipt-delivery failures. Connector output contains fixed module/check metadata only: no student identifiers, row contents, counts, tokens, secrets, SQL, errors or stack traces. The console uses the current organization only; connector reports global product metadata.

A successful report returns HTTP 200 even with degraded modules so SYSTEM IN ONE can ingest failures. HTTP success means collection, not product health. Each failed read becomes a generic FAILING check independently. UNKNOWN remains visible for unprobed sign-in, booking completion, payment reconciliation, PDF generation/download, messaging/activation workflows, actual email delivery, scheduler execution and automatic WhatsApp. Merely configured credentials do not prove external services work. No paid or live end-to-end actions are triggered by observation.

## First controlled repairs

Within an organization-scoped transaction, with an advisory lock:
- Unconsumed SENDING invitations and SENDING notice emails with missing/old attempt timestamps become REVIEW. No resend occurs: a crashed worker may already have sent the message. Preserve recipients, generation, provider identifiers, attempts and live invitation tokens for reconciliation.
- Unconsumed expired invitation tokens become EXPIRED and their token hash is cleared. ACTIVATED/consumed invitations are excluded. Existing activation checks already reject expired links.
- Actual changes create a HEALTHFIX_SAFE_REPAIR audit record atomically with aggregate counts, source and version. Repetition without changes creates no extra audit. Failed audit rolls back repair writes.

No account access, password, financial data, charges, payment allocations, receipt contents or signed acceptance is modified. A late provider response cannot overwrite REVIEW because sender completion updates require SENDING. HealthFix never guesses delivery success, resets attempts or queues an uncertain retry. Review/reconciliation of ambiguous email remains a management/provider task.

This is limited automatic maintenance, not unrestricted self-repair or complete synthetic monitoring. The daily worker is scheduled at 08:00 Africa/Nairobi; deployed code does not itself prove the scheduler ran. Repairs/history can be checked manually. Database outage alerts require the external collector; this page cannot serve through a complete authenticated database outage. No native Android/iOS probes, automatic deployment fixes, credential changes, financial repairs or support chatbot are added by this change.
