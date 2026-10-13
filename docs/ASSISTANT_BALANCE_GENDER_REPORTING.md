# Assistant: Correct outstanding balance and gender breakdown

## Reproduced user screenshots
1. `How much is balance` incorrectly routed through the collected-payments classifier and showed KES 353,500 collected. It must answer the hostel's OUTSTANDING ledger balance, not money received.
2. `How many students are male and female` was passed to the model, which correctly lacked gender data but responded with unrelated visitor and photo links. It must return a targeted verified student summary.

## Outstanding balance
Management first resolves exact named-student or room questions. Bare balance references the last room or student only when a signed, session-bound context exists. Without context, it retrieves all applicable outstanding non-waived hostel charges and unreversed applied payments, uses minor currency units, checks every payment's currency and student/organization identity, and clearly labels the resulting total as money STILL OWED, not received.
Approved accounting scopes use Africa/Nairobi period windows, including semester and charge due date. Bank, M-Pesa and cash balances are never invented; a verified reconciliation is required for actual cash available. If a finance inconsistency is found, the AI fails closed to Financial Integrity. Zero and credit balances are not misrepresented as debt.

## Student gender data — opt in, not inferred
The existing Student model contained NO gender field. The optional `StudentGender` enum adds MALE, FEMALE, OTHER and PREFER_NOT_TO_SAY. Existing students remain NULL/NOT RECORDED. Student admission, protected student-edit forms and the assistant's approved new-student workspace support entering this information only when directly supplied/confirmed by the resident. It is not required for a hostel place, payment, booking or portal access.
The management-only aggregate gender report groups active hostel students by recorded gender and separately reports NOT RECORDED. No gender is guessed from a student's name, photos, room type or honorific. Incomplete data is explained plainly: zero recorded male/female choices does not prove there are no boys or girls. General AI providers do not receive individual gender data, and tenants/caretakers are denied aggregate reporting unless policy explicitly changes.

## Schema and safeguarding
`prisma/migrations/20261013080000_student_gender_optional/migration.sql` adds a nullable enum column; no existing values, students, rent, payments or receipts are rewritten. Prisma migrate deploy runs under the preexisting build release process; the migration is additive and not data backfilling. Management changes remain secured by the existing audited student create/edit server actions.

## Tests and acceptance
`npm run test:assistant-balance-gender` asserts the exact screenshot questions, finance intent collisions, bank balance restriction, signed contextual balance detection, reversed-payment exclusion, zero/unknown demographics, organization isolation and end-to-end authenticated intent routing. Full `npm run build` continues to validate all existing modules, Prisma migration and Next.js TypeScript.
Final operator acceptance should sign in on the owner's own phone and ask: `How much is balance?`; `How much did we collect?`; `How many students are male and female?` and compare with Payments and the optional recorded genders. The unknown count will remain high until students' genders are voluntarily captured. A live bank reconciliation and other record-level acceptance must not be inferred from Vercel READY.
