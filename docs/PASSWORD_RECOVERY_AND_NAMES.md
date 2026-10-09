# Password recovery and hostel name protection

Both management and tenant sign-in pages link to Forgot password. Management uses the registered login email. Tenants can identify their account by registered email or phone; recovery is delivered only to the stored email. Accounts without a usable email require independently verified management assistance. A shared-directory request also requires the hostel's managed address, so duplicate emails in different organizations are never guessed. Disabled/archived accounts cannot regain access through recovery. Enabled former residents retain recovery for their permitted account access.

A 256-bit random token is stored only as a SHA-256 digest. Links expire after 30 minutes and are bound to the property, canonical hostname, recipient and account session version. Opening a link does not consume it. The password update, increment of the session version, consumption of all outstanding account links and audit event commit in one transaction. Old cookies no longer authenticate. Passwords must match, contain at least 12 characters and fit bcrypt's 72-byte limit. Recovery changes the hostel credential only; SYSTEM IN ONE credentials and access checks remain separate.

Published hostels issue links to their own managed domains. Unpublished hostels issue links to studentshostels.com, with their property scope retained. Neither forwarded headers nor a supplied URL can control the recovery-link origin. Unknown identities receive the same response. Persistent hourly limits allow three identifier/account requests, 100 per organization and 1,000 platform-wide. Rate-limit keys are HMAC digests rather than raw personal identifiers.

The existing RESEND_API_KEY, RECEIPT_EMAIL_FROM and SESSION_SECRET configuration is required. Email sending runs after the public response, so provider latency does not disclose whether an account matched. Provider acceptance is distinct from mailbox arrival. Uncertain sends are recorded as REVIEW without automatic retry. HealthFix reports configuration, database availability and recent failed/uncertain sends without exposing tokens or identities. The authenticated daily job removes rate buckets older than two days and recovery records expired more than 30 days ago. Audit history is retained.

Recovery pages use no-store, no-referrer and noindex protection. Tokens are not logged by application code. Host/provider request logs must retain the same access protections as existing tenant activation links.

## Name uniqueness

New provisioning, organization settings and public property-name changes all apply the same availability check. PostgreSQL also enforces uniqueness, including writers outside these UI routes. Names compare after Unicode NFKC normalization, punctuation/spacing removal and case folding. Thus `MMA MBUGUA HOSTEL`, `mmambugua hostel` and `MMAMBUGUA-HOSTEL` cannot identify separate hostels. The saved spelling is preserved. An organization's own public property may share its name; two properties cannot claim the same normalized name. Website addresses are unchanged when a name is edited.

The migration runs in a transaction. It stops with HOSTEL_NAME_CONFLICT_REVIEW_REQUIRED if pre-existing names overlap. It does not rename, merge or delete any existing hostel. Resolve any real conflicts with their owners before retrying a failed migration.

## Verification

Run `npm run test:recovery` and the existing unit suite. For the isolated PostgreSQL-compatible fixture suite, install `@electric-sql/pglite` 0.4.3 and `@electric-sql/pglite-socket` 0.1.3 in a separate test directory, set PGLITE_MODULE_ROOT to that directory's node_modules, then run `npm run test:recovery:database`. It runs every migration against a fresh in-memory database, uses only example.invalid recipients and replaces the email provider with a local fake. No live credentials or customer records are needed.

Production acceptance still includes receipt of a requested reset email by the account owner. Configuration and fake-provider checks alone cannot establish real inbox delivery. This feature does not verify production backup restoration, background push or automatic WhatsApp delivery.
