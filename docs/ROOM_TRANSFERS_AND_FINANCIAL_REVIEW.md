# Room Transfers & Financial Reconciliation — Management Module

## Scope

This is one coherent hostel-management module, including actual room transfers, recorded
rate snapshots, semester rent, payments, review cases, and owner-attested investigation notes.
All lookups are scoped to the authenticated organization. Existing public/tenant routes
do not expose management evidence notes.

## Main routes

- `/occupancy`: current residents and entry point for transfer review
- `/occupancy/transfers`: current/historical transfer-case register with filters,
  review flags, contract overrides, balances and recorded note counts
- `/occupancy/[id]/transfer-review`: complete read-only chronology and scenario
  comparisons; Owner/Admin can append an investigation note
- `/occupancy/[id]`: current room, financial ledger, movement history and link to
  the complete transfer case
- `/occupancy/[id]/transfer`: guarded new transfers and explicit rent-treatment choice
- `/payments/audit`: overall financial audit with transfer-case navigation

## Contract and accounting rules

1. The **recorded semester rent is authoritative** until the owner explicitly approves
   a correction. Never infer an overpayment from a different tariff alone.
2. Transfers use saved `OccupancyRoomStay` entries and rate snapshots. The physical
   date of actual occupation **may differ** from the date entered into the system.
3. An owner-approved custom adjustment remains protected. Monthly and full-destination
   alternatives are **previews only**, not payable invoices, credits or refunds.
4. The monthly preview assigns the destination room's monthly rate starting with the
   recorded transfer calendar month. Partial-month, special-owner and retroactive
   agreements need independent verification.
5. A new transfer requires one semester charge, consistent currency, exactly one open
   current room-stay record (unless a legacy occupancy has no history at all),
   chronological contiguous segments, and a move later than the current stay start.
   Keeping the current rent requires matching **both** monthly and semester tariffs.
6. M-Pesa receipts, original payment references, active paid totals, and historic
   adjustments are not rewritten through case review.

## Evidence and physical-stay disputes

The Owner/Admin may record one of:
- Reported discrepancy
- Management observation
- Reference to a source document **not uploaded or verified**

An observation can contain a *claimed* physical transfer date. It is **not proof**,
and **does not change `Occupancy`, `OccupancyRoomStay`, `Charge` or `Payment`**.
Only an authenticated active Owner/Admin may record notes. A form submission carries
a UUID request ID and SHA-256 digest of the reviewed ledger and room history; the
server independently re-reads those records in a serializable transaction, rejects
stale views, and writes an idempotent immutable audit event with the actual staff
user ID. Replaying the same UUID creates no second note.

For the MMAMBUGUA HOSTEL discrepancy tracked in GitHub issue #84: the owner reports
only two days physically in Room 60, but the recorded history shows 5 September–11
October 2026. Management must compare signed tenancy/check-in records, security
registers or actual transfer messages before changing historical records.
The approved Room 54 semester charge remains KES 28,000, paid KES 13,500,
outstanding KES 14,500. **This release does not correct those dates.**

## Isolation, test and release gates

The build runs `test:transfer-full-module` and `test:transfer-evidence`, in
addition to established charge adjustment, historical monthly, transfer identity,
finance, authentication and regression tests. Cases include:

- Current stay chronology, gaps, overlapping and backdated transfers
- Single charge and currency restrictions
- Equal and unequal monthly/semester rates
- Owner-protected full-destination semester rate, including Room 54
- Corrected Room 24 KES 18,000 private single without re-pricing
- Accurate KES 13,500 / KES 14,500 and KES 9,000 / KES 9,000 payment balances
- Authorization, revoked session, foreign-organization access, stale digest,
  duplicate note prevention and immutable accounting records
- Read-only assistant navigation (the AI cannot approve transfers)

Vercel preview must report READY before merge; verify production READY and read-only
financial results after deployment. No batch repair, automatic outbound messages,
or physical-date mutation is authorized by this module.
