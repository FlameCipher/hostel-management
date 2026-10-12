# MMAMBUGUA HOSTEL — Verified Knowledge Brain

## Implementation
The assistant now retrieves verified organization identity, published property details, active room-type prices, nominal bed vacancies, semester dates and versioned hostel accommodation rules from existing first-party sources. It does not invent hostel history, electricity uptime, personal rent rates or unavailable details.

The official policy is src/lib/hostel-terms/policy.ts, version 2026-10-08-v2. It covers semester rent, gate entry/exit hours, visitors (common area only), CCTV and Wi-Fi, borehole-water safety, holiday-retention conditions, cleanliness and checkout. Published policy is not a real-time facility test.

### Authenticated conversation context
A room question such as 'Who is in Room 41?' can issue an HMAC-signed room-only pointer. The 15-minute token binds organization, user, current role and session version, and carries no payment or identity data. On 'How much has he paid?' the server rechecks staff permission and re-queries the room ledger; shared rooms are reported resident by resident. Tampered, expired, different-user and revoked-session tokens are rejected.

The browser keeps the token in the current mounted chat state only. The API accepts at most 1,200 characters of signed context after checking session and request origin. Nothing is stored in URLs, browser storage or provider prompts.

### Policy and access
Every database query takes its organization ID from the active authenticated session. Tenant-facing knowledge is limited to active, publicly listed property records. Staff can read authorized operation records. A caretaker is not permitted to read personal ledgers. Personal tenant-account questions direct the tenant to their private statement. Existing approval-gated student registration and payment recording remain unchanged.

### Testing and rollout
Run npm run test:assistant-knowledge and the full npm run build. Release only a clean READY preview commit after PR review, then verify READY production and inspect logs. Owner-device acceptance still must verify room follow-up, rates, gate/visitor rules, published contacts and actual signed-in operation. No test or source change writes live payments or changes tenant accounts.

This is a controlled, verified knowledge integration, not proprietary model training or a claim that the AI knows undocumented facts.