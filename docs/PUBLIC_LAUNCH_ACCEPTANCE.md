# MMAMBUGUA HOSTEL — production launch acceptance and public smoke test

## Purpose and scope

This read-only release check supplements, but never replaces, `/gate-readiness`,
`/healthfix`, the financial integrity review, live staff/operator checks, email
provider evidence or backup restoration. It sends **GET requests only** with no
login cookies or bearer secrets. It must never create a fake caretaker, visitor,
student, rent adjustment, payment, receipt or email merely to mark a launch ready.

The production target is `https://mmambugua.studentshostels.com` and the official
property name is `MMAMBUGUA HOSTEL`. The live deployment and linked domain must
be independently checked against the latest approved `main` commit in Vercel.

## Running the check

From the repository with Node 20.9+:

```sh
node --test scripts/test-public-launch.mjs
node scripts/verify-public-launch.mjs https://mmambugua.studentshostels.com 'MMAMBUGUA HOSTEL'
```

The first line is a deterministic, isolated test with mock HTTP responses.
The second line queries the real public domain. It does not use a password,
private session or payment data. It checks:

- Published homepage and property identity
- Management/resident login, booking and install guidance availability
- Property-specific PWA manifest and actual PNG app icons
- Unauthenticated restrictions on payments, student register, visitor/gate
  operations, tenant account and tenant visitors
- Unauthenticated `401` for the HealthFix connector and the three scheduled
  worker endpoints (no worker is triggered, because no secret is supplied)

Exit code 0 = all automated probes passed. Exit code 1 = at least one definite
failed check. Exit code 2 = missing arguments, invalid target, or one or more
network-unverified checks with no known failures. None of these codes claims
that all business operations are production-certified.

GitHub Actions workflow **Hostel public release acceptance** runs the isolated
unit tests on pull requests. Its `workflow_dispatch` can be manually triggered
by an authorized maintainer to check the fixed production hostname. There are
no required secrets and no automatic scheduled visitor, payment or email probes.

## Real-world owner acceptance: all are manual gates

1. **Access/identity:** The owner verifies an actual named employee, creates
   an individual CARETAKER account in `/users/new?role=CARETAKER`, and watches
   the employee sign in from their own phone and change their password. Check
   direct payments/reports URLs deny access. Do not share the owner login.
2. **Resident access:** An existing resident with the actual current room
   self-registers through `/tenant/register`; Owner/Admin confirms physical
   identity before approval. Confirm the resident can open statements and send
   a private question without seeing any other student's content.
3. **Visitor:** A real eligible resident submits a genuine visitor request;
   named gate staff verify visitor, student and current room in person; record
   real entry and subsequent departure. An overdue reminder does not prove
   that the visitor is still inside.
4. **Communications:** Verify the sending domain, configured provider,
   sender and appropriate recipient on a *consented test address only*.
   Distinguish provider acceptance, mailbox delivery and actual reading. No
   general tenant broadcast or automatic WhatsApp is permitted as a test.
5. **Mobile:** Install and reopen the correct property app on a physical
   Android and iPhone. Test offline information, restored connectivity,
   revoked-session sign-out and identity separation across hostel domains.
6. **Data/recovery:** Run provider-sourced PostgreSQL backup restoration to
   a new isolated database with notifications and schedules disabled. Compare
   organization/room/occupancy counts, balances, receipts, terms and visitor
   history; record actual recovery time and point. Never restore over live data.
7. **Financial and transfer cases:** Reconcile selected real receipts and
   owner-approved rent in the read-only financial review. Sheila's current
   Room 54 approved semester rent remains KES 28,000; paid KES 13,500;
   outstanding KES 14,500. The separate Room 60 physical-stay date dispute
   remains open pending independent supporting evidence; never recalculate
   or rewrite her account as a side effect of launch acceptance.
8. **Client #2 / subscriptions:** Do not onboard a second paying landlord
   until real two-organization read/write isolation, plan entitlements,
   subscription billing and separate app branding/domain acceptance pass.

## What remains outside this script

This test does not certify current database readiness or migrations, login with
real credentials, a successful booking, actual payment gateway collection,
receipt PDF contents, provider inbox delivery, WhatsApp Business automation,
Cron execution, HealthFix repair, physical gate attendance, native iOS/Android
installation, complete backup restoration, or a multi-tenant commercial launch.
Source code and GitHub Actions results must not be labelled as live acceptance.

If a probe fails, verify the production deployment SHA and actual domain
configuration before changing code. Review evidence and logs. Avoid production
writes, delivery retries, migrations or credential changes as diagnostic probes.
