# StudentsHostels onboarding and System In One control plane

## Purpose

SYSTEM IN ONE is the mother platform. StudentsHostels is Product #1. MMAMBUGUA HOSTEL remains the first live customer/property and must not be converted into the software brand.

This phase defines onboarding and platform administration without depending on the pending Property backfill migration in PR #21. No production data migration is included here.

## Roles and boundaries

### System In One Super Admin

A platform-level role, separate from every client organization. It can manage products, plans, subscriptions, provisioning status, platform support, tenant suspension/reactivation, domain requests, licensing metadata and platform audit events.

It must not silently impersonate a landlord or alter tenant financial records. Any support access to a client environment must be explicit, time-limited where practical, permission-controlled and audited.

### Client organization

Each landlord/landlady operates inside one Organization tenant boundary. Organization users must never be able to query another organization's students, guardians, rooms, payments, receipts, expenses, assets or settings.

### Property

An Organization may own one or more properties. MMAMBUGUA HOSTEL is Property #1 for the first live organization once the Property migration is safely repaired and deployed.

## Landlord / landlady onboarding flow

1. Create account: name, verified email, phone, password and acceptance of terms.
2. Create organization: business/owner display name and organization slug.
3. Select StudentsHostels plan. The platform must read plan capabilities from server-side entitlements; the browser must never be authoritative.
4. Create first property: hostel/property name, physical address, contact phone/email and optional branding.
5. Provision tenant environment transactionally. A failed step must not leave a half-created subscription or accessible property.
6. Invite additional staff with least-privilege roles.
7. Show a launch checklist before the property can accept real bookings/payments.
8. Billing and subscription state is enforced server-side. Suspended/past-due behavior must be deliberate and must not destroy client data.

Self-service onboarding remains disabled for real Client #2 until cross-organization isolation tests pass.

## Subscription and licensing model

StudentsHostels supports hosted subscription plans plus future dedicated/white-label licensing.

Plan capabilities should cover, at minimum:
- maximum properties, rooms and staff users;
- custom domain entitlement;
- white-label entitlement;
- M-PESA/payment integration entitlement;
- messaging/notification entitlement;
- advanced reporting/API entitlement.

Dedicated/perpetual licensing is not the same as source-code ownership. Source ownership remains with SYSTEM IN ONE unless separately contracted.

## Platform Super Admin areas

The future control plane should provide:
- Organizations: status, owners, properties and support state.
- Products: StudentsHostels now, additional System In One products later.
- Plans & entitlements: pricing and feature limits.
- Subscriptions/licences: trial, active, past due, suspended, cancelled/expired and future dedicated licences.
- Provisioning: requested, provisioning, active, failed, suspended.
- Domains & branding: platform URL, custom-domain verification and white-label settings.
- Billing: invoices/payment-provider references without exposing unnecessary payment secrets.
- Support: explicit audited access and issue tracking.
- Audit & security: platform-level immutable event trail for privileged actions.

## Security invariants

Every client-owned query and mutation must carry an organization boundary derived from authenticated server-side identity, never from a trusted client-supplied organization ID alone.

Cross-organization IDs must fail closed. This includes direct reads and writes for rooms, students, guardians, occupancies, charges, payments, receipts, expenses, assets and files.

Platform Super Admin authorization must use a separate platform permission boundary from Organization roles OWNER, ADMIN, MANAGER and CARETAKER.

Secrets, database URLs, M-PESA credentials and signing keys must never be returned to the browser or stored in audit payloads.

Financial history must remain append-only/audited; subscription suspension must not delete accounting history.

## Client #2 launch gate

Before a second real landlord/landlady is onboarded:

1. Repair and deploy PR #21 successfully.
2. Backfill MMAMBUGUA HOSTEL as Property #1 and verify all existing rooms remain attached to the correct organization/property.
3. Create a dummy second organization and property only for testing.
4. Prove isolation for rooms, students, guardians, occupancies, charges, payments, receipts, expenses, assets and mutations using foreign IDs.
5. Verify custom-domain/branding lookups cannot cross tenants.
6. Verify suspended organizations cannot create new operational/financial records according to the agreed policy.
7. Only then enable self-service registration or onboard Client #2.

## Implementation order

Phase A: finish Property backfill safely (PR #21).

Phase B: add platform-level account/role model and entitlement service. Avoid scattering plan-name checks throughout UI code.

Phase C: build landlord/landlady onboarding behind a feature flag, with transactional provisioning and idempotency.

Phase D: build System In One Super Admin as a separate protected control plane.

Phase E: create dummy tenant and automated isolation tests.

Phase F: enable real multi-client onboarding only after the isolation gate passes.

## Domain responsibility

- systeminone.com: mother platform, product catalogue, commercial onboarding, subscriptions/licensing, support and Super Admin.
- studentshostels.com: StudentsHostels product marketing, landlord/landlady entry and later student-facing discovery/booking.
- MMAMBUGUA HOSTEL: first customer/property, retaining its own identity and operational environment.

The existing hostel-management application should evolve incrementally into StudentsHostels. Do not rewrite MMAMBUGUA or move production records in one uncontrolled change.
