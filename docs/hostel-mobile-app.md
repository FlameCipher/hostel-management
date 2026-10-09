# Installable hostel apps

Every active, published property with its own configured domain automatically gets an installable web app. There is no separate account or App Store build. `/install` gives device instructions; registration and activation success, tenant accounts, management dashboards and menus expose it.

`requestPropertyContext` resolves the actual Host against the published property. The manifest, Apple icon and PNG icons use that public property only. A shared directory, unknown host or legacy alias cannot publish another hostel's app identity. Each origin and property ID has its own stable manifest ID; renaming does not create a duplicate app. The shared install page points signed-in management to its own published property domains.

`/open-app` is the fixed launch URL. It checks the existing, current staff and tenant sessions; one valid session opens its corresponding account, two offer a choice, and no valid session offers sign-in. Never put an invitation token, user ID, room or session in a manifest or start URL. Login cookies remain host scoped and existing revocation and permissions apply.

Chrome's deferred installation prompt is only opened by a user's click. Acceptance is described as an installation request until the browser confirms `appinstalled` or standalone mode. Safari gets Share → Add to Home Screen instructions. Unsupported browsers keep normal website access. No notification permissions, push delivery, native store listing or automatic installation are provided.

The worker is deliberately network-only. It intercepts same-origin GET document navigation with `cache: no-store`, and returns a generic embedded offline page on network failure. It does not use Cache Storage, cache private HTML/API data, intercept server actions, or queue/replay writes. An open app shows an offline banner. An interrupted submission must be checked against the current record before retrying. Updates wait for existing tabs to finish and never force-reload a form.

Validation: `npm run test:hostel-app` covers host isolation, stable identity, international names and worker request boundaries/offline behavior. Also verify PNG dimensions, mask-safe artwork, manifest discovery, per-host identities, registration success, current/revoked session launch, standalone/install/dismissal states, iOS instructions, narrow layouts and offline reload with an isolated production build. Real Android/iOS OS installation needs a device check; desktop emulation cannot prove OS installation.
