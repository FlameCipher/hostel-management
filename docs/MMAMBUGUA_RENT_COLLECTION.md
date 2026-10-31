> For the new individual payment requests and automatic verification, see [AUTOMATIC_RENT_PAYMENTS.md](AUTOMATIC_RENT_PAYMENTS.md). The general store link documented below still requires manual matching.

# MMAMBUGUA hosted rent collection

Verified and configured in the existing Sampesa Group Limited Pesapal account on 31 October 2026.

- Payment page: https://store.pesapal.com/mmambuguahostelrent
- Hostel guide: https://mmambugua.studentshostels.com/pay-rent
- Currency: KES only. Payer chooses the amount. No recurring charge or additional surcharge configured.
- Required custom fields: student full name and room number; semester or rent period.
- Existing settlement configuration was not changed. No payment or withdrawal was made during setup.

The public guide requires a published property belonging to `mama-mbugua-hostel`, with organization currency KES. The home link and authenticated staff/student cards use the same organization/currency restriction. No payment data is passed in URLs. The student card appears only when a recorded balance is outstanding.

This release links to hosted checkout. It does not implement API checkout, IPN verification, automatic ledger posting or automatic hostel receipts. Staff verify a completed payment in Pesapal, check its reference has not already been entered, match student/charge/amount/currency, record the payment, then send the hostel receipt. Returning to the site never changes a balance.

The first title containing an em dash exposed a Pesapal `btoa` error: creation saved an inactive draft but the editor could not open it. That unused draft, “MMAMBUGUA HOSTEL — Rent Payment”, remains inactive. The published page uses the plain-text title “MMAMBUGUA HOSTEL Rent”.

Future automatic reconciliation requires a separate verified order record bound to organization/student/charge/merchant/amount/currency, provider-side status verification, idempotent ledger posting, mismatch and reversal handling, and end-to-end payment testing. Existing notification endpoints must be preserved. Do not credit a student from a browser return or unverified notification.
