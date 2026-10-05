# SYSTEM IN ONE → StudentsHostels tenant isolation

StudentsHostels remains the data owner for hostel operational records. SYSTEM IN ONE supplies only the external customer identity and commercial entitlement.

## Binding rule

`Organization.platformOrganizationId` is the unique external SYSTEM IN ONE organization identifier. It is nullable so existing customers, including MMAMBUGUA HOSTEL, remain unchanged until an explicit audited binding is approved.

`Organization.platformProductCode` records the product context. For this product the expected value is `STUDENTSHOSTELS`.

## Safety gates

- Never infer or bind an existing StudentsHostels organization by name, email, phone, slug, or property name.
- Never bind SAMPESA GROUP LIMITED to MMAMBUGUA HOSTEL automatically.
- A new platform customer must receive a new StudentsHostels organization unless an administrator explicitly approves a verified migration/binding.
- Every operational query must continue to scope data by StudentsHostels `organizationId`.
- A platform identifier may resolve to at most one StudentsHostels organization; the database unique index enforces this.
- Provisioning must fail closed if the platform identifier is already bound to another tenant.
- Existing MMAMBUGUA data is not modified by this migration.

## Provisioning contract

The future provisioning endpoint must accept an authenticated server-to-server request containing the SYSTEM IN ONE organization ID and product code, validate the product code, create or return only the matching isolated tenant, and never expose another organization's records.

No remote provisioning endpoint is introduced by this foundation.
