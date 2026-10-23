# Platform administrator authentication foundation

This branch introduces the authentication boundary for the future SYSTEM IN ONE control plane.

## Security decisions

- Platform administration uses a dedicated cookie: `systeminone_platform_session`.
- It uses a dedicated secret: `PLATFORM_SESSION_SECRET`; it must not reuse the hostel staff `SESSION_SECRET`.
- The cookie is HTTP-only, Secure in production, SameSite=Strict, and scoped to `/platform`.
- Organization roles (OWNER, ADMIN, MANAGER, CARETAKER) do not grant platform access.
- `requireSuperAdmin()` is the server-side gate for future platform routes.
- No database migration, admin seed, login UI, or production credential is introduced in this phase.

## Next phase

Add a persistent PlatformAdmin model and audited login/provisioning only after the database migration blocker in PR #21 is resolved or in a separate migration that has been validated safely. Never create a default hard-coded super-admin password.
