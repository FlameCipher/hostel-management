# Domains, branding, audit and security

## Domains & branding
The first screen inventories Product.domain and Property.customDomain only. A stored domain is not considered DNS-verified. Future activation must verify ownership/routing with the hosting or DNS provider and check plan entitlement.

## Audit & security
The first screen documents the current control-plane posture without exposing organization financial audit records.

A dedicated platform-level audit event store is still pending. Before any Super Admin mutation is enabled, the platform must record actor, action, time, target and safe before/after context. Secrets, password hashes, tokens and provider credentials must never enter audit payloads.

Support impersonation remains disabled. If introduced later, it must be explicit, time-limited where practical, visible and audited.

No Prisma migration or production-data mutation is introduced by these screens.
