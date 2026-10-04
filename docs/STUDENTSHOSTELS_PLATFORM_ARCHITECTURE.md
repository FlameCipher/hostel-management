# StudentsHostels.com — Multi-Tenant Platform Foundation

## Brand hierarchy

- **SystemInOne.com** — mother platform, commercial ownership, product catalogue, licensing and future products.
- **StudentsHostels.com** — Product #1, the student accommodation management and booking platform.
- **MMAMBUGUA HOSTEL** — first live client organization on StudentsHostels.

## Core rule

A client is an `Organization`. All operational records must remain scoped to exactly one `organizationId`. No authenticated route, server action, report, export, receipt, lookup or background task may trust an organization identifier supplied by the browser when the authenticated session already determines the organization.

MMAMBUGUA-specific defaults must progressively move from source code into organization settings. New organizations must be provisioned without changing application code.

## Client models

StudentsHostels supports four commercial deployment modes:

1. **Subscription** — shared SaaS infrastructure with strict tenant isolation.
2. **Professional / custom-domain** — SaaS tenant with client branding and a mapped domain.
3. **White-label** — client-facing branding with System In One ownership retained contractually.
4. **Dedicated licensed deployment** — isolated deployment/database where required; core IP remains System In One unless a separate source-code agreement exists.

## Platform capabilities required before Client #2

### Tenant identity and isolation
- Stable organization slug.
- Organization lifecycle: trial, active, suspended, cancelled.
- Every operational query scoped by authenticated organization.
- Cross-organization IDs rejected server-side.
- Tenant-aware audit events.
- Isolation tests for sensitive modules.

### Product and licensing
- Product identity: StudentsHostels.
- Subscription/licence record per organization.
- Plan and feature entitlements.
- Usage limits (properties/rooms/users/storage/integrations).
- Trial and renewal dates.
- Suspension must preserve data and prevent destructive side effects.

### Property hierarchy
An organization may operate one or many properties. The existing MMAMBUGUA data is initially treated as one property. Property support must be introduced without losing existing records.

Target hierarchy:
`System In One -> StudentsHostels -> Organization -> Property -> Rooms -> Occupancies`.

### Branding and domains
Per organization:
- legal/display name
- logo and brand settings
- public contact details
- receipt prefix
- custom domain
- public booking identity
- payment/integration configuration

The product brand remains **StudentsHostels — A System In One Product** unless a white-label entitlement permits otherwise.

### Roles
Existing roles remain organization-scoped. System In One platform administrators must be separate from landlord/landlady organization roles; a platform administrator must never be represented as an OWNER inside every customer organization.

### Security
- Preserve separate staff and student sessions.
- Add tenant-session secret separation before broad rollout.
- Rate-limit authentication and public lookup endpoints.
- Enforce server-side authorization on every mutation.
- Never expose another organization's student, guardian, payment, receipt, room or integration data.
- Financial records remain auditable and non-silently editable.

## Migration strategy

Do not rewrite the working MMAMBUGUA application.

1. Harden the current `Organization` boundary.
2. Add platform/licensing metadata without changing existing MMAMBUGUA behavior.
3. Add `Property` and backfill MMAMBUGUA as the first property.
4. Move hostel-specific defaults to organization/property configuration.
5. Add onboarding/provisioning for a second test organization.
6. Run isolation tests using two organizations before onboarding a real second client.
7. Only then expose self-service registration/subscription.

## Domain strategy

- `systeminone.com`: mother company/platform.
- `studentshostels.com`: hostel product and public marketplace.
- Client custom domains: optional plan feature.
- MMAMBUGUA can retain its existing address during migration; no abrupt domain cutover.

## Non-negotiable launch gate

Client #2 must not be onboarded until automated tests prove that an authenticated user/student from Organization A cannot read or mutate Organization B records, including by guessing IDs or calling server actions directly.
