# MMAMBUGUA one-time late-payment rule

Release: 1 November 2026. Owner selected 10%, one time, unpaid principal only. This is a product implementation of the owner's rule, not a legal determination of enforceability.

## Dates and acceptance

Terms v3 introduce the rule for explicit student acceptance. Earlier signed snapshots remain unchanged and downloadable. Each acceptance fixes the first future 10th of the month in Africa/Nairobi; acceptance on the 10th uses the next month. The applicable deadline is the latest of that first date, the original rent account due date and an approved payment extension. The full deadline day is honoured. No backdating or management acceptance on a student's behalf.

## Posting

The existing authenticated daily payment-reminder cron runs assessment before notices. Only the MMAMBUGUA organization is configured. Only active/reserved current tenancies and semester rent are eligible. Exact scoped acceptance, snapshot integrity, allocation and current ledger are rechecked inside organization/student/charge locks. The fee is 10% of unpaid principal at assessment, rounded half up to currency minor units. A separate OTHER charge references the original rent, terms acceptance and principal. A unique parent-charge constraint prevents repeats, including after a waiver. Non-rent fees never compound. Posting and audit commit together. No access denial is implemented.

## Messaging

Formal demands include the server-generated Nairobi notice date, recorded due date, and the relevant accepted-policy deadline or pending-acceptance explanation. Cleared accounts and active agreed dates remain excluded. Message previews are invalidated when policy/date state changes. Queued notices refresh against current records. No date placeholder is required. The general writing assistant receives today's server date and refers account-specific deadlines to the account/structured demand flow rather than inventing them.

## Verification

Unit checks cover rounding, timezone/month boundaries, extension precedence, neutral AI speech wording and automatic message dates. Isolated PostgreSQL-compatible tests apply every migration and check unsigned/foreign scopes, full-day grace, extensions, partial/cleared/reversed payments, tampered acceptance, audit rollback, concurrent retries, no compounding, waived fees and non-rent exclusion. No production students were signed up, billed or messaged during verification.
