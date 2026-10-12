# MMAMBUGUA HOSTEL — Complete Assistant Management Module

## Assistant architecture and boundary

The assistant combines:
1. **Deterministic operations** for debtor totals/amount collected, room occupancy,
   visitor queue, registration status, caretaker counts and receipt-delivery queues.
2. **Conversation guidance** through the configured language model. Only documented
   guidance and authorized aggregate counts go to the external model; debtor ledgers,
   student identity, payment references and room occupant names are not sent.
3. **Protected transaction workspaces** for student admission and recording an
   actual payment. The model itself has no permission to execute SQL or write data.

The UI is at `/assistant`. It is staff-session protected and tenant-organization
scoped. `CARETAKER` may only query rooms, gate and visitor details; finance,
registrations and payments remain management-only. The staff role and session
are independently checked by the server. A client-provided role or student ID
cannot override authorization.

## Conversational examples

- "Who hasn't paid?" → live, read-only unique-student debtor list and total.
- "Show outstanding rent for October 2026" → charges *due* in October (not
  silently all current-semester charges).
- "How much have we collected?" → unreversed recorded payments, all periods.
- "How much did we collect in September 2026?" → payment date filter.
- "Who is in room 54?" → recorded current room allocation, with a warning that
  physical presence isn't independently verified.
- "Who has not checked out?" → overdue **unrecorded visitor departures**, not
  a claim guests remain inside.
- "Show pending registrations" → verified count plus management review link.
- "Show receipts pending delivery" → outstanding provider/manual delivery queue.
- "Register a new student" → opens assistant-led admission review (no automatic save).
- "Add a payment" → opens assistant-led payment review (no automatic save).

## Student admission: Prepare → Review → Confirm → Continue

Only an authenticated Manager, Admin or Owner sees the protected assistant
action workspace. The operator enters actual full name, verified phone,
optional unique admission number and emergency contact, university,
accommodation type and active semester. The review displays the selected
semester charge using the organization's actual saved rate. The operator must
affirmatively check authorization and select Confirm. Submission reuses
`createStudentAction`, which validates identifiers, unique student matches,
active semester/room type and organization, then atomically creates the student,
guardian (if supplied), rent charge and audit event. It redirects to initial
payment. **No room is assigned until the existing payment/room-allocation
workflow is followed.** The chat must never claim admission happened before
server confirmation.

## Payment: Prepare → Review → Confirm → Receipt

Only an authenticated finance-authorized manager sees the available current
unwaived charges, scoped by organization. The operator chooses the exact
student/charge, enters the verified received amount, payment date, method
and transaction reference. Electronic payments require a reference. Review
shows the original unpaid balance, amount, expected balance and method.
Only the confirmed form calls `recordPaymentAction` / `recordPayment`.
That canonical path verifies current session/version and finance role inside
the transaction, correct organization and currency, current unpaid balance,
M-Pesa duplicate references, audited receipt issuance, rent status updates,
and payment linkage. Completion redirects to the original receipt or required
room allocation. **No AI prompt can claim that M-Pesa cash was actually
received.** Duplicate cash/multiple-submit incidents must be reconciled
against issued receipts; don't blindly resubmit after a connection failure.

The review is a usability and informed-approval step; no client-side preview
is a substitute for the server's authoritative validation. The pending button
is disabled while saving. Existing payment/receipt records are untouched by
the deployment.

## Operational safeguards

- Deterministic database replies are possible even when provider AI is down.
- Every query uses the session's organization ID. The provider never gets
  student/guardian identity or individual financial data from those queries.
- Missing data, multiple properties with one room number, mismatch warnings
  and actual external delivery remain clearly marked.
- Hostels cannot use this tool to change another organization's records.
- Account changes, rent changes, visitor entry/exit, email/broadcast sending
  and HealthFix repair are outside this assistant's autonomous write access.
- General question support requires HOSTEL_AI_ENABLED, a valid configured
  model and an accessible OpenAI Responses API key. Existing rate/usage limits
  remain. A production build cannot prove provider billing/access.
- The system does not constitute a separately trained proprietary AI model;
  it is a controlled application assistant using the configured provider and
  deterministic first-party business logic.

## Test/release gates

Build runs `test:assistant`, `test:assistant-management`,
`test:assistant-operations` and existing student, finance, transfer, receipt,
visitor, tenant access and security tests, then validates Prisma migrations and
compiles Next.js. Live release requires Vercel preview READY and matching
production commit READY. No synthetic test may write real student, payment
or visitor records.

For real operational acceptance, Owner/Admin signs in on their own device,
checks an actual read-only debtor answer, inspects the student/payment review
screen without saving, then chooses a legitimately authorized real record for
an actual approved transaction. Compare the resulting receipt, balance and
audit in the standard management screens. Physical presence and M-Pesa receipt
evidence must be independently confirmed.
