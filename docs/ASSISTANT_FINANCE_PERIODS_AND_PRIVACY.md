# AI assistant — accounting-period precision and private student ledger safeguards

## Why this patch is necessary

A visually polished assistant is not production-reliable if "this month" or "this semester" silently returns the all-time ledger. The initial AI finance reader applied explicit named months, but did not correctly interpret Nairobi-relative dates and active semesters. Also, questions naming a particular student could fall through to the overall collections command or a general external AI answer. Those are incorrect and potentially privacy-sensitive outcomes.

## Exact authoritative definitions

Finance report windows use Africa/Nairobi local calendar boundaries, converted to half-open UTC ranges for database comparisons (`>= start`, `< end`). Supported periods: today, yesterday, this/last week (Monday–Sunday), this/last month (including year rollover), this/last year and explicitly named months/years.

- "Who hasn't paid this semester?" → only non-waived rent/other charges linked to the one authenticated hostel ACTIVE semester. Two active semesters or none cause an explanation, **not a silent all-time fallback**.
- "Who hasn't paid this month?" → charges with **due dates** in the Nairobi month. This is not the same as everyone with an unpaid balance from any older due date.
- "How much have we collected this month?" → unreversed payments whose **payment dates** fall in the Nairobi month. It does not filter by charge due date and is not an independently reconciled bank statement.
- "Last semester collections" → unreversed payments received within the recorded previous semester date range, not necessarily assigned to that semester's charges; report explicitly labels payment-date basis.
- "What did Room 41 pay in October?" → registered occupants in the exact hostel room, with payment receipts recorded during October, separately from their allocation-semester balance.
- "How much has Sheila paid?" or "What is Sheila Nyaboke's balance?" → restricted named-student lookup. A name matching multiple student records does not choose one or display financial figures; instead management must select the exact record in Payments.
- Private finance prompts that do not match a verified deterministic ledger request are **not forwarded to the generic language model**. The assistant asks for a precise verified name, room and period or provides a secure register link. It must never invent an amount.

## Privacy, integrity and role boundaries

The authenticated organization comes from the current staff session; no browser-provided organization ID or personal name is treated as proof of identity. All named-student and room lookups are scoped to that organization. Caretakers cannot access financial reports. Reversed receipts and waived charges are excluded from the corresponding financial calculations. Amounts use currency-specific minor units, and payment-to-student, charge-to-student, currency or cross-organization mismatches block financial answers.

The assistant does not initiate payments, rewrite rent, register a student, activate a portal, send messages or infer physical presence from a ledger query. Existing approval-gated transaction handlers remain authoritative.

## Mobile polish

The conversation now scrolls inside its own message area; it no longer calls `scrollIntoView` on the whole page after each response, which could jump the phone screen away from the composer. Existing reduced-motion handling and the compact responsive layout are preserved.

## Verification and acceptance

The production build includes `test:assistant-finance-period`, `test:assistant-student-account`, strengthened `test:assistant-room-account`, plus the complete existing finance, student, visitor, password, tenant-isolation and AI suites.

Release requires a READY Vercel preview for the final GitHub head, followed by a merge and READY production verification. No code test proves a real owner has signed in; owner acceptance should compare these exact questions with the protected financial register on a phone, including one shared room and a real receipt:

- Who hasn't paid this semester?
- How much did we collect this month?
- What did Room 41 pay this month?
- What is the balance for a named resident?

This patch is read-only: no schema migration, receipt delivery, financial write, student registration or unauthorized account access.
