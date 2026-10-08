# Global self-service: approved rules and remaining delivery

## Commercial decisions (8 October 2026)

- StudentsHostels is a global, location-led landlord platform operated through SYSTEM IN ONE.
- The one-time platform setup fee is **USD 40.00**, explicitly selected by the owner after reviewing the approximately USD 38.50 converted value of KES 5,000. Use USD 40 as the fixed displayed and checkout amount; do not recompute it with subsequent exchange-rate movements.
- Subscription pricing, billing period, taxes, renewal, cancellation and refund terms must be approved and displayed before checkout. No recurring amount was supplied in this request; do not invent one.
- A landlord chooses the tenant rent collection methods available in their country. Pesapal, the landlord's own M-Pesa Paybill, both, or another method are choices, never a mandatory pair.
- Rent belongs to the landlord's payment flow. Setup/subscription charges belong to the platform's payment flow, with separate orders, merchant ownership, receipts and reconciliation.
- A verified successful platform payment should automatically activate the purchased access. An active paid owner should create and manage authorized staff without a separate manual commercial approval.

## Delivered in the website update

- Structured property country, city, region, address, postal code, optional coordinates and IANA time zone.
- Country/city directory search and explicit property location with map search or exact coordinates.
- Country, city and valid time zone required for new publication; existing published properties are not automatically unpublished.
- Booking date validation in the property's time zone. Unknown legacy locations use UTC until configured, not a global Kenya assumption.
- Landlord-editable, optional rent payment preferences. These are saved preferences, **not connected payment integrations**.
- Public landlord setup pricing USD 40.00, separated from student accommodation charges.
- Expanded property information, room rates, booking process, viewing questions, FAQs and contact/portal navigation without inventing facilities.

## Payment activation work still required

The existing access model uses commercial approval and entitlements; it does not yet prove that an invoice has been paid. No live platform payment collection is enabled by this website update.

1. Connect the platform's own payment merchant account and approved settlement currency/countries. Do not reuse a landlord's rent collection credentials.
2. Create server-priced orders with immutable currency and integer minor-unit amounts, organization, product, plan, fee line items and merchant identity. Price the setup fee once per entitled organization/product using a unique billing record. Reuse an open checkout for retries rather than charging twice.
3. For Pesapal, receive IPN as a signal and query GetTransactionStatus server-side. Match the original reference, provider tracking ID, expected merchant, amount and currency; grant access only on verified COMPLETED. A return-page redirect, client checkbox, screenshot or unverified callback never activates access.
4. Persist provider events and payment reconciliation idempotently, with uniqueness constraints and database locking. Handle duplicate/out-of-order events, expired checkout, timeouts, failed payments, refunds and reversals.
5. Atomically record payment and activate a dated subscription and product entitlement, then provision the landlord workspace through an idempotent outbox. Retry failed provisioning without charging again. Let the customer see payment/provisioning status and receipts.
6. Enforce paid access on server requests, including direct staff creation, password sessions, SSO, publication and provisioning. Resolve tenant context from the authenticated organization. Invitations, staff roles and ownership must never grant another landlord's data.
7. Preserve current authorized customers through an explicit migration policy. Do not abruptly suspend an existing landlord by treating missing historic invoices as unpaid. Renewal, grace and cancellation rules need approved terms.
8. Run provider sandbox tests for paid activation, failed and mismatched payments, replay, retries, cross-tenant access, refund/reversal and expired access before enabling live checkout.

## Other global requirements still open

- Organization-level accounting currency and locale migration, including historical balances, invoices and receipts. Current accounting remains KES; do not relabel existing money as USD. Setup pricing in USD does not convert hostel rent or historical accounts.
- Full localization of operational dates, phone normalization, receipts, translations and accessible form error handling. Booking local dates are only the first timezone step.
- Country-specific payment availability, settlement, taxes, privacy/retention, consumer terms and emergency contacts require operational review. This release does not claim worldwide regulatory certification.
- User-managed account security, role permissions, auditability and tenant isolation should be verified together with the billing flow.

Technical references: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus ; https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html .
