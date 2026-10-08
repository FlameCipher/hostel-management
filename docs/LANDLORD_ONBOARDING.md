# Approved landlord onboarding

SYSTEM IN ONE already provides registration, email verification and organization/product access requests. Commercial entitlement and provisioning require platform approval; this implementation does not bypass that approval or create paid billing automatically.

A newly provisioned organization is marked platformBootstrapAllowed=true. Its verified active central OWNER must confirm first-owner setup with a browser-bound one-use grant. The consume transaction checks explicit marker, active organization, product and zero existing users, creates a mapped owner with an unrevealed random password hash, clears the marker and consumes the grant atomically. Existing organizations default false and retain explicit credential-confirmed linking. No emailed passwords or notifications are generated.

Hostel Setup at /setup lets an owner/admin edit public property details, create accommodation types and use existing rooms/staff tools. Only the owner can publish. Publishing requires shared sign-in, current central identity/entitlement, mapped product organization, a valid assigned property subdomain, location, description, contact and at least one active room with positive prices/capacity. Publication is explicitly confirmed, scoped by organization and audited. Unpublished properties do not render publicly.

Remaining: automatic commercial approval/payment collection, KES 2,000 monthly per-property billing, self-service additional-property creation and property-specific staff roles. Existing room numbering and staff access remain organization-wide. A new real owner setup and live paid subscription have not been verified.
