# Gate Staff & Operational Readiness — Complete Module

## Goal and scope
Provide MMAMBUGUA HOSTEL and future StudentsHostels properties with a
role-appropriate gate workspace, secure first-staff onboarding and an explicit
operational acceptance dashboard. The module does **not** create named people,
reset credentials, activate student accounts, send communications, or record
fictional visitor arrivals/departures.

### Routes and navigation
- `/gate-readiness`: Owner/Admin-only readiness page, with current staff counts,
  active students, portal activation, real recorded visitor entries/exits, and
  actionable acceptance checklist; no auto-correcting features.
- `/users`: owner/admin staff list and number of active Caretaker/Security accounts.
- `/users/new?role=CARETAKER`: preset **role only**. The owner must enter the
  actual authorized employee's own name, email and private temporary password,
  and click Save. Neither this URL nor deployment creates an account.
- `/visitors`: CARETAKER's home page, including live expected/inside/overdue,
  tenant-host-room validation, and manual verified entry/exit actions.
- `/assistant`: CARETAKER shortcut to the gate queue, expired/unrecorded
  departures and rooms; not financial transaction or mass communication tools.
- `/healthfix`: links gate readiness to technical monitoring and distinguishes
  functional synthetic tests from real-world operator sign-in.

### Role policy
Navigation filtering is **not authorization**. All routes above operate with
server-verified organization-scoped authenticated sessions. Direct URL access
to financial summaries, payments, rent receipts, expenses, CSV/PDF reports,
and global receipt/national-ID search rejects CARETAKER, not merely hides a link.

Owner and Admin retain existing authorized controls. Manager retains existing
finance/operational permissions except Owner/Admin-only staff provisioning,
HealthFix repairs and gate readiness. CARETAKER sees only Visitor gate, Rooms,
Occupancy list, System Assistant, Install App and own Account in the sidebar;
student-register and occupancy-detail financial fields are not shown.

The existing database-driven staff permission checks still enforce an active
session version. Role changes and staff deactivation revoke current sessions.
No shared gate logins or unverified staff identities are created.

### Real-world acceptance checklist
1. Owner/Admin independently confirms the authorized operator's identity and
   enters their individual contact and temporary private password.
2. Operator signs in on their own device, changes the password, and checks
   that only the permitted gate navigation is visible; test that a pasted
   Payments, Reports or Users URL cannot show a financial record.
3. A genuine resident with an active tenancy submits a visitor request from
   their own tenant portal, with consent for the required visitor details.
   Owner/Admin verifies tenant identity before account activation.
4. Gate verifies the visitor, host and current room *in person*, then records
   arrival. Entry is refused when the visit is too early, expired, duplicated
   or the host's original room is no longer active.
5. Gate verifies actual departure before recording checkout. An unrecorded
   departure after the expected time is a warning, not proof the guest remains.
6. Owner/Admin checks the actual audit history and the HealthFix visitor check.
   Physical Android/iPhone and WhatsApp delivery acceptance remain separate
   and must never be reported as passed based only on code tests.

### Release and test gates
- `test:gate-staff-readiness` tests all menu-role combinations, direct financial
  route checks, privacy of student and occupancy finances, caretaker home and
  active-gate readiness counts.
- `test:gate-staff-provisioning` tests real staff save transaction semantics using
  isolated mocked data: only active Owner/Admin may create a CARETAKER account,
  user credentials are hashed, existing sessions cannot bypass revocation,
  and the operation writes a staff audit event.
- Existing Visitor Operations, Resident Services, Student Portal and HealthFix
  test suites continue to run with this change.
- Vercel READY preview required before merge, followed by READY production
  verification, runtime warning review, and read-only ledger and staff counts.

### Pre-release verified baseline (12 October 2026)
MMAMBUGUA HOSTEL has 32 active student occupancies, 1 portal-enabled tenant,
0 Caretaker/Security accounts, 1 Owner, 1 Admin, 0 visitor requests.
Do not invent a caretaker name, password, guest visit or payment to make these
counts look ready.

Joseph Room 24 rent KES 18,000, paid KES 9,000, outstanding KES 9,000.
Nyaboke Room 54 rent KES 28,000, paid KES 13,500, outstanding KES 14,500.
All financial records must remain untouched by this module release.
