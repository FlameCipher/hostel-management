# Management account settings

Every active management user, including landlords and landladies, can use `/account` (My Account or Settings) to update their own hostel login email or password. Public organization/property contact email is independent. SYSTEM IN ONE credentials are independent; its existing password management is linked from this page.

Changes require a matching confirmation, explicit sign-out consent and current password proof. Ordinary sessions prove the current hostel password. Shared sessions prove their current SYSTEM IN ONE password through the fixed authenticated server-to-server credentials endpoint, including owners whose first local password was generated and never disclosed. The bridge rechecks verified membership, active organization, entitlement and central session version. Each service permits five confirmation attempts per account in 15 minutes and stores no passwords in audits.

The hostel mutation locks the current scoped user, rechecks active access/current session version, uses only authenticated identity, rejects same-organization email collisions, hashes passwords with bcrypt 12 (minimum 12 characters, maximum 72 UTF-8 bytes), records a sanitized audit, and increments the local session version atomically. Both local and shared hostel sessions validate that version on subsequent requests. Legacy versionless sessions are accepted only while the account version remains zero. Successful changes sign out this browser too. Shared linkage is by verified central user/organization IDs, never by the mutable email.

Staff administration also revokes sessions after changing a user's credentials, role or active state. Self credential changes in Users & Permissions direct the user to My Account so current-password proof cannot be bypassed there.

Deployment order: central credentials bridge first, then the hostel additive User.sessionVersion migration and UI. An unavailable bridge fails closed. No real user credentials, messages or payment data are changed by tests/deployment.

Validation: 124 hostel tests; 450 existing central regression tests plus 14 shared-login/credential tests; TypeScript, targeted ESLint, both production builds; isolated actual two-application HTTP journey covering wrong password, shared/local credential changes, stale sessions, form identity injection, mutable email/link preservation, first-password setup and central revocation.
