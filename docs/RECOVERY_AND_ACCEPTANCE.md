# Release recovery and acceptance

## Recovery boundary

The application uses PostgreSQL. A successful build, database connection or fixture restore does not prove the production backup can be restored. The production provider backup policy and restore drill still need verification through the database provider account.

Before a drill, record the backup timestamp, retention policy and restore target. Restore to a new isolated database, never over the running production database. Disable all cron jobs and email/WhatsApp credentials on the restored application. Restrict access to the restore environment. Do not point the restored app at the live database or publish its tenant content.

Validate migration state, organization/property/room counts, active allocations, charge and payment totals, signed terms, visitor gate history, invitation state and photo categories. Confirm credentials and role isolation without emailing customers or reusing production session cookies. Check every property-to-organization and room-type-to-organization relation. Compare the restored values against the backup snapshot, then run the local functional suite against the isolated copy. Record achieved recovery time and the newest recovered record timestamp.

The October photo migration is additive and preserves existing records. Unclassified website pictures are hidden for owner review; they are not deleted. Old room-photo records are retained. Restore or application rollback must never republish unclassified photos without review. Take a provider backup before later destructive schema changes.

## Real-user acceptance

Use a separate test hostel with its own website and non-customer accounts. Verify:

1. Owner creates staff, resets a temporary password, and the staff member changes it. Show/Hide affects the typed password only.
2. Existing resident requests access; management verifies identity and approves the matching resident. A different hostel cannot activate the invitation.
3. Resident and owner exchange a private conversation. Another resident and caretaker cannot read it.
4. Resident requests a visit in the hostel time zone; authorized gate staff verify arrival and actual departure. An overdue record flags missing checkout without asserting presence.
5. Android and iPhone users install the hostel web app from its own domain and reopen the correct hostel. Verify offline guidance and account sign-out on the physical devices.
6. Owner categorises an exterior, compound and four room-type interiors. Several identical rooms share one gallery; private/shared types remain distinct. The fifth photo is rejected. Only an exterior can be the cover.
7. Owner reviews older pictures before republishing. Invalid category uploads and cross-hostel edits are rejected.
8. Confirm provider email acceptance separately from mailbox delivery. Reconcile ambiguous sends; never blindly retry them.

Generative AI, background push and automatic WhatsApp remain separate integration tasks requiring provider configuration and device/delivery verification. No test should send an unsolicited message to a real tenant. Payment-gateway integration remains intentionally deferred.
