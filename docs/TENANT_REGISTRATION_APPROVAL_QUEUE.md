# MMAMBUGUA HOSTEL — Tenant Registration Approval Queue

## Release scope

This is one integrated upgrade to existing tenant self-registration, the management verification queue, audit history, and the activation transaction. It does not change the tenant's rent, room, payments, receipts or current login password unless an Owner/Admin/Manager explicitly verifies an existing resident and activates their submitted account.

## Why grouping matters

On 16 October 2026 MMAMBUGUA had **23 currently valid PENDING registration submissions** but only **14 distinct combinations of property, submitted name, registered phone and room**. Nine were repeat submissions. Twelve pending submissions appeared to have an exact existing-student match, while eleven did not; these counts refer to submissions, not unique verified people. Two distinct submitted combinations also reused phones across different name/room details. None of these submissions constitutes proof of identity.

## Reviewer workflow

1. Open `/students/registrations` as an authorized Owner, Admin or Manager.
2. See the live active-student, enabled-portal and pending-submission counts and distinct review cases.
3. Filter by Exact match, Needs investigation or Repeated submissions. Search by name/phone/room/property.
4. Each case displays the latest submission. Earlier identical submissions remain available in a collapsed audit view. The form cannot approve an older attempt when a newer one is pending.
5. Even for a single exact match, **verify identity independently** in person or using trusted contact information already in the official register. Never use only the submitted name, phone, room or newly chosen password as proof.
6. If the same phone appears with different names or rooms, neither identity can be activated until the discrepancy is resolved; reject invalid requests with a documented reason, or ask the resident to contact management.
7. Approval validates organization and live staff role, locks the student, request and property against concurrent changes, rechecks the full pending queue for that phone, validates the latest request, confirms matching student/room/property/phone/name and account eligibility, then activates exactly that existing student's portal password. Older identical pending attempts become `SUPERSEDED` with their hashes cleared in the same transaction. These original request records and audit trail remain preserved.
8. Rejected requests require a reason and may include a brief management note (do not include full ID numbers/passwords).
9. Reviewed, expired, rejected and superseded requests appear under Review History.
10. No approval, rejection, message, login or invitation is triggered solely by deploying this software.

## Critical safeguards

- One organization scope on all reads and writes; property + phone + normalized name + current room defines a repeat group.
- A phone shared across distinct name/room requests is a **conflict**, not a duplicate identity.
- A later submission cannot be bypassed to install an earlier password.
- Existing activated or previously used portal accounts require account recovery; no takeover via public self-registration.
- Registration requests expire seven days after submission; expired requests cannot authorize access.
- Staff actor and identity-verification state are included in an audit event. Account activation clears unneeded invitation credentials; superseded request passwords are discarded.
- Avoid bulk activation: the Owner/Admin/Manager must explicitly approve each independently verified resident. No M-Pesa, rent or WhatsApp changes.
- For a multi-property landlord, the entire workflow remains organization scoped and compares the correct room's property.

## Test and operations acceptance

`test:tenant-registration-queue` covers grouping, cross-name phone conflicts, latest password wins, replay, account collision, staff verified confirmations, tenant scoping, documented rejections and supersession audit metadata. Existing `test:existing-tenant-easy-signup` and `test:existing-tenant-reliability` continue to cover two-step mobile registration, Kenyan number formats and provider-independent user experience. The complete project suite, Prisma schema/migration check and Next.js build must be READY before merge.

After deployment, review real requests on a phone and independently verify **one** resident before activation. Do not claim this manual acceptance happened unless management actually performed it. Keep live tenant financial records unchanged and verify production metrics after the release.
