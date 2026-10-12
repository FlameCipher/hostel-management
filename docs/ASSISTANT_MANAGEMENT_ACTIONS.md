# AI Management Desk — live financial answers and guarded actions

## What is verified in this module

The authenticated hostel assistant may now answer **who has not paid** and **how much money has been collected**, using deterministic, read-only database queries under the authenticated hostel organization and finance-authorized management role. It does not send a tenant's ledger to the generative model. It uses the same `Charge` (`SemesterCharge`), unreversed `Payment`, and organization currency records shown in the existing Payments screen.

Owner, Admin and Manager may ask:
- "Who hasn't paid?" / "List outstanding rent for October 2026" / "Show debtors 2026-10"
- "How much have we collected?" / "Total money received October 2026"
- "Register a student" / "Add payment KES 9,000"

The first two commands **answer in the assistant conversation**, with actual student balances, current room when uniquely known, total unreversed payments/charges and a direct read-only register link. Charge questions filter named months by the charge's due date; collection questions filter named months by the payment's date. Absent a month, the text explicitly labels **all recorded semesters**, not the current semester. Credits are not counted as debts. Results are grouped by unique student ID, never just by name. Currency, student/payment identity and tenant-scope discrepancies stop the answer and send management to financial integrity review. The report names its observation time and, above 30 debtors, makes the full list available through Payments.

**Write instructions** ("Register a student", "Record payment") currently return a clear explanation and a link to the existing protected **Add student** or **Record payment** forms. The assistant does **not** silently save a registration, payment, receipt, rent change or message. Staff must inspect student identity, tenancy, amount, payment method and payment reference, then explicitly submit the normal form. Server-side validation, permissions, duplicate references, audit and receipt integrity remain solely in the existing authoritative transaction handlers.

A caretaker or tenant **cannot** call the finance command: the server checks the active database staff session and management finance entitlement before any query. The client menu is not the security boundary. Other hostel organizations cannot be selected by prompt text, because the organization ID comes from the trusted authenticated session.

The existing OpenAI/AI SDK assistant still handles ordinary navigation and system questions, subject to its environment configuration, permissions, usage limits and provider availability. Deterministic finance answers work even if the generative provider is unavailable; they never rely on the model inventing ledger records. The AI is not yet an autonomous accounting agent.

## Known scope and next authorized release

This is a safe first step towards the approved **Assistant → Draft → Review → Confirm → Execute → Receipt/Audit** architecture. A future full action module must do all of the following before allowing chat-triggered mutations:

1. Resolve the student using an exact hostel-scoped identifier; require explicit selection when names collide.
2. Prepare a server-generated preview with room, outstanding charge, exact currency, amount, reference, payment time, before/after balances and expected receipt number rules.
3. Recheck current role, active session, charge/payment linkage, reference duplication and financial integrity in a database transaction.
4. Present clear affirmative approval. A repeated message, network retry or regenerated AI suggestion must not double-post.
5. Reuse the existing authoritative registration and payment service, issue a signed receipt, record actor/approval/audit ID and show verified result. Never trust a model-generated payment reference or silently mark an M-Pesa transfer as received.
6. Retain least-privilege access, organization isolation, immutable history and specific protections against prompt injection.

An audio/voice interface, own-model routing, safe tools for visitor/check-out, broadcast draft/approval, bank reconciliation and automatic repairs remain separate acceptance modules.

## Release and testing

The focused `npm run test:assistant-management` checks the intent classifier, month constraints, unique-student grouping, payment deductions, duplicates/credit handling, exact KES balances and mismatch safeguards. Full production builds include this test alongside the existing AI, payments, student, tenant, receipt, room transfer, WhatsApp and security tests. This module contains no schema migrations and no financial data mutations.

The UI changes the previous "who hasn't paid?" redirect into a real server answer, displays server-provided navigation actions and distinguishes live records from generative answers and protected workflow links. Do not label it a complete autonomous write agent: **registration and payment are still explicit staff form submissions.**
