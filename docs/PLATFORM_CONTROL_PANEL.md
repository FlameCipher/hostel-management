# SYSTEM IN ONE control panel shell

The protected `/platform` route is the mother-platform control plane and is intentionally separate from every client organization.

## Initial sections
- Organizations
- Products
- Plans & entitlements
- Subscriptions & licences
- Provisioning
- Domains & branding
- Audit & security

The shell requires `requireSuperAdmin()`. Organization OWNER/ADMIN/MANAGER/CARETAKER sessions do not satisfy this guard.

The `/platform/login` page is deliberately non-functional until a persistent PlatformAdmin identity, audited provisioning and a safe credential bootstrap are implemented. There are no hard-coded platform credentials.

This phase performs no Prisma migration and does not depend on the blocked Property migration in PR #21.
