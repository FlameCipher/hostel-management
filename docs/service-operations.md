# Assistant, delivery and recovery

The assistant is read-only. It sends the question, role-specific system guide and permitted counts to Vercel AI Gateway; it does not transmit visitor names, room labels or saved message contents. Questions and generated answers are not stored by this application. Provider data handling remains subject to the configured gateway/provider. Per-account, per-hostel and project-wide limits cap usage. The documented guide remains available during outages.

Device notifications require each user's explicit permission on their own published hostel domain. Lock-screen copy is generic. The worker rechecks current access and session version before delivery and retires expired subscriptions. Sign-out disables the current device subscription. Browsers and phones control alert display; iOS users must open the installed Home Screen app. Real-device delivery still requires a device acceptance test.

## WhatsApp activation

Automatic delivery stays inactive until the platform has its Meta app secret and the hostel has saved a verified business sender. Configure `WHATSAPP_APP_SECRET` securely in the deployment environment. Use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` when subscribing Meta to `https://studentshostels.com/api/whatsapp/webhook`. Never paste these credentials into messages or source control.

In Communications → WhatsApp, an owner/admin enters the phone-number ID, WABA ID, supported Graph API version, sender access token and approved utility template. The integration supports a text template with one positional body variable and no header/button components. Meta verifies the sender and approved template before saving; the access token is encrypted with the hostel ID as authenticated context. Enabling automatic sending is explicit. Meta charges may apply.

Recipients opt in in their account, or management records explicit permission and its evidence. Withdrawal and changed phone numbers stop eligibility. Only eligible future messages are queued automatically; historic drafts remain manual. Receipt links and invitations are generated for events after sender verification and recipient opt-in. No group chats are created. Incoming conversations remain in WhatsApp.

Accepted is provider acceptance, not proof of delivery. Signed Meta callbacks update Delivered/Read. Uncertain sends enter Review and are never blindly retried. Verify them in Meta's logs before any manual follow-up. Manual actions cannot race an automatic send. Turning off the sender pauses future sends; it cannot retract messages already accepted by Meta.

## Private backups and restore drills

The production cron captures a consistent logical PostgreSQL snapshot daily at 01:30 UTC (04:30 EAT). It includes migration SQL, all public application tables, per-table checksums and referenced live photos in the approved public Blob store. Local snapshot limits are 50 MiB of row JSON and 60 MiB of photos; exceeding a limit fails visibly rather than claiming a partial backup. Increase capacity through an external backup worker as the installation grows.

`BACKUP_BLOB_STORE_ID` points to a separate **private** store; it must never replace the public photograph store. OIDC is preferred. `BACKUP_BLOB_READ_WRITE_TOKEN` is supported if explicitly needed. A new backup must be read back and validated before old snapshots become eligible for deletion; retention is 30 days. Preserve deployment secrets separately: database hashes and encrypted provider tokens cannot reconstruct external credentials. Source code is recovered from its recorded Git commit. Backed-up photo bytes retain their original URLs; a disaster restore must upload those bytes and update photo references if the original store was lost.

The authenticated operations endpoint supports fixed AI, delivery, backup and restore-verification probes only. Its dedicated `OPERATIONS_VERIFY_SECRET` can retrieve sensitive backups and must be restricted to operators, rotated if exposed, and never placed in a browser client. Preview uses a different secret and cannot download production backups. Unauthenticated probes return 401.

To test a downloaded private snapshot, install `@electric-sql/pglite` in an isolated verification environment and run:

```sh
PGLITE_MODULE_ROOT=/path/to/node_modules npm run backup:verify -- /private/backup.json.gz
```

The verifier creates a fresh in-memory database, applies the captured migrations, removes migration seed data, imports all rows with application triggers temporarily disabled, validates all foreign keys, restores triggers and checks every table count/checksum and each photo checksum. It never connects to or restores over production. Run it only on authenticated backups from this application; migration SQL is executable code. Record the restore receipt only after the verifier succeeds. HealthFix reports capture and restore evidence separately.

For an actual disaster, restore to a new private database, preserve the migration history using normal Prisma deployment, import the validated snapshot, restore external photo objects as needed, verify application access/financial totals, then explicitly change the production database binding. Never overwrite a live database as a diagnostic step.

## Validation

`npm run test:services:database` uses an isolated PGlite database and fake delivery providers. `PGLITE_MODULE_ROOT` may point to an existing dependency installation. The scenarios exercise authorization, limits, provider failure, device revocation, consent, deduplication, manual/automatic exclusion, signed callbacks and a full isolated restore. No real messages are sent.
