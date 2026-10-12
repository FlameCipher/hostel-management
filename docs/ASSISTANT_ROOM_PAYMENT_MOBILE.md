# MMAMBUGUA HOSTEL — Room-Specific Finance Assistant and Mobile Chat

## Problem reproduced from owner's Android screenshot

The question **"Who is in room 41 how much did he pay"** was incorrectly classified as the global collection question and returned an all-hostel, all-period ledger total instead of Room 41's current resident's payment details. A second issue was usability: the assistant showed a long introductory paragraph, large primary buttons, and lengthy visible documentation instead of a mobile-first chat.

## Corrected intent and accounting scope

- The assistant recognizes the phrase `room <number>` combined with a specific finance term (paid, payment, pay, balance, rent, owed, receipt, etc.) **before** its generic global collection classifier. It also handles "Room 41 payments" and "Show Room 41 how much he paid".
- Server role checks from the current authenticated session are decisive. Only active OWNER, ADMIN and MANAGER roles get payment amounts. CARETAKER cannot use the room-account financial handler.
- All queries constrain organization IDs from the trusted session. If more than one property under the same organization has Room 41, the assistant does **not** guess which property to read.
- The current active or reserved occupant register is authoritative for which student ID is queried. A room with no current allocation cannot be used to infer payment ownership.
- A shared room is shown per resident, never by guessing who "he" means. Payment sums are grouped using student IDs, not human names or room labels.
- For each resident the response distinguishes current semester charges, payments linked to those charges and current semester outstanding balance from the all-period sum of **unreversed** recorded payments. The current semester comes from the student's active/reserved occupancy. Waived charges are excluded.
- Currency or student/payment identity mismatches suppress numeric results and send management to the financial integrity review. All sums use currency-specific minor units.
- The answer explicitly identifies the figures as hostel ledger records, not independent M-Pesa/bank confirmation. It does not change rents, charges, payment records, receipts or room history.
- Links to the protected Payments and Occupancy registers allow manual verification.

## Mobile UX changes

The assistant screen is now led by a compact responsive conversation layout with clear distinction between user questions and assistant answers. The composition input stays prominent, a short horizontal set of prompts is available, answers use readable chat bubbles, and protected action links appear directly with each response. A short privacy/approval note replaces the large paragraph.

Detailed system guides appear in a **collapsed Related help** section after a question, and live resident activity is in a **collapsed alerts** section below the chat. They are not removed or hidden behind permissions, but do not dominate the initial mobile viewport. The app uses MMAMBUGUA's existing slate/blue-neutral color family, respects reduced motion, and handles narrow devices.

The existing approved management workflows remain. "Register a student" and "Record payment" still open the reviewed in-chat forms with explicit human confirmation; there are no AI-driven automatic writes.

## Release and safety

Run `npm run test:assistant-room-account`, all existing assistant/finance/room/tenant/regression tests, TypeScript and a full production build before merging. No migration is needed. Public/anonymous browser testing cannot verify signed-in ledger answers, so the owner should test the specific Room 41 question in the deployed assistant and compare against the protected Payments register.

Do **not** reinterpret the original global collection number as a Room 41 payment, and do not modify any financial record to make a test pass.
