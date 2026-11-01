# Automatic rent payments

MMAMBUGUA HOSTEL can connect the existing SAMPESA Pesapal API 3 account from **Payments → Payment connection** (`/payments/gateway`). Only its current owner may connect. Live collection remains disabled until the credentials authenticate and the hostel IPN is registered. The credentials are encrypted using `SERVICE_ENCRYPTION_KEY`, scoped to the organization, and never returned to the browser. Do not place credentials in chat, git, logs or screenshots. Preview/development deployments cannot use the live gateway.

After connection:

- Staff use `/payments/requests` to choose a student charge, amount and payer: student, saved guardian or another person. Requests can be emailed directly with Resend, or copied/shared. Email acceptance is distinguished from confirmed inbox delivery. A share window is not counted as a sent message.
- Students use `/tenant/pay` after sign-in. New students need a registered record and rent charge first. The shared public guide remains `/pay-rent`.
- A private, random 256-bit request link allows the chosen payer to review the amount and open Pesapal checkout. Only the bound charge can receive the payment; client input cannot select another student at checkout. The link expires for starting checkout after seven days.
- Staff can choose **M-Pesa prompt — open secure checkout** and supply the payer's mobile number without email. Creating this request opens the existing Pesapal checkout directly. Staff choose M-Pesa, confirm the number and amount, and initiate the prompt there; the payer authorises only on their own phone. This is a hosted-checkout flow, not a direct STK API call from the hostel. Link sharing and email remain separate options. Existing requests can be reopened without creating another request.
- If opening checkout fails, keep the original request and display its current status. Ambiguous provider responses remain under reconciliation and cannot create a second order automatically.
- Cash remains a staff entry, with a dedicated **Record cash received** shortcut. Existing offline and earlier general-store transactions still need matching; they are never retroactively guessed from a name or amount.

## Verification and accounting

Pesapal calls `/api/payments/pesapal/ipn` using POST. The callback returns through `/api/payments/pesapal/callback`. Both query the authenticated GetTransactionStatus endpoint; neither trusts browser parameters as proof of payment. Merchant reference, persisted tracking ID, amount, currency and the provider's completed status must match. The merchant connection is immutable for each request.

Posting locks the organization, request and charge, then creates the payment, sequential receipt, receipt integrity hash and audit entry in one transaction. System postings do not impersonate staff. Repeated notifications cannot credit twice. A matching manually recorded receipt is linked rather than duplicated; conflicting references require investigation. If a charge decreases while a payment completes, all money actually received is recorded, with any excess appearing as a credit. Confirmed provider reversals reverse the linked payment and recompute the balance. A late completed response cannot resurrect a reversed payment. Provider-verified amounts cannot be edited or reversed through manual correction forms.

A checkout is submitted only once. If the submission response is lost, the system waits for a verified callback/IPN rather than creating a second payable order. Missing tracking IDs can be recovered only from an authenticated provider response matching that exact merchant reference. An unresolved submission, mismatched payment or conflicting reference is a real exception for investigation, not a reason to claim payment succeeded.

`/api/cron/rent-payments`, protected by `CRON_SECRET`, runs every five minutes. It retries missed notifications and temporary provider failures, and delivers pending gateway receipts to the registered student email. Receipts are immediately downloadable from the payment result page. No email is required for receipt issuance. Completed transactions are rechecked daily for reversals. The existing Resend sending safeguards remain in use; no inbox delivery claim is made.

## Activation and validation

Required existing server configuration: database, `SERVICE_ENCRYPTION_KEY`, `CRON_SECRET`; Resend credentials and sender for email delivery. Gateway credentials are entered through the owner-only connection form. Connecting adds a hostel IPN; it does not replace other merchant listeners or alter the settlement account. No live charge, refund or settlement transfer is part of setup.

Validation performed before release:

- `npm run test:pesapal`: status, amount/currency/reference validation, redirect allowlist, production gating and API request contract, using mock provider responses.
- `scripts/test-pesapal-database.ts`: empty disposable local PostgreSQL engine (PGlite socket), schema baseline plus new migration; duplicate notifications, reference collisions, manual-payment matching, automatic balances/reversals, stale completed callbacks, preserved credits, authorization/tenant boundaries, request/email idempotency, ambiguous submissions, forged notifications, recovery and transaction rollback. No live provider calls or real student records used. PGlite serializes connections; native multi-session PostgreSQL contention was not load-tested.
- Existing payment correction, receipt queue and balance-date tests; TypeScript, ESLint and production build.

To repeat the database tests, apply the previous schema followed by `20261031150000_automatic_pesapal_collection` to an **empty disposable localhost database**, then run:

```sh
HOSTEL_PAYMENT_TEST=local-fixtures PESAPAL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55437/postgres node --import tsx scripts/test-pesapal-database.ts
```

The script rejects non-localhost URLs and databases containing organizations. Fixtures intentionally remain in that disposable database for inspection. Never point it at production.

Live credentials, a completed real payment and live webhook delivery must be verified separately before describing end-to-end live collection as tested.


## Default M-Pesa flow

The rent form now goes directly to the existing Pesapal checkout for staff and tenants. It requires a payer name and mobile number; it does not show an email field or delivery-method selector. The three instructions are: enter details, confirm the number and press Proceed in Pesapal, then authorise the prompt on the payer’s phone. No PIN is collected by the hostel. The button is labelled “Continue with M-Pesa” because opening checkout does not send an STK prompt itself.

Recent requests and share links are collapsed. An unattempted email is not reported as a delivery problem. Legacy email/link server submissions remain supported for already-open clients, but the default when delivery is omitted is checkout. Cash recording remains a separate staff link.

Pesapal controls its hosted payment methods. M-Pesa was selected in the live checkout inspected on 1 November 2026. The published SubmitOrderRequest API does not document a method-filter parameter; this change does not hide or modify Pesapal’s other options, invent a direct STK endpoint, or change settlement settings. Payment completion still requires verified provider confirmation.
