# AI Assistant — Person Search and Conversation Resolution

## Reproduced Android bug
User asked `Am looking for David kirumba` and assistant responded that no record was supplied, without searching the student database. On follow-up `Which David is available` the knowledge router detected `available` as room vacancy and incorrectly displayed available beds and rates.

## Correct behavior
Management may ask `Am looking for David Kirumba`, `Find David`, `Which David is available`, `Where is David Kirumba?` and `Who is David Kirumba?`. The assistant searches the current organization's registered Student records using a bounded case-insensitive first-name candidate set, then filters full-name tokens and shows recorded registration and active/reserved room assignment. If there is no exact full-name match, it explicitly labels first-name alternatives; if no match exists, it clearly says so and links to Students / Visitors without inventing an identity.

`Available` about a named person never implies bed availability, on-site physical presence or contact availability. The assistant clarifies whether the user means actively registered, room-allocated, physically on-site or reachable. It does not invent answers for those not captured by the system.

Follow-ups such as `Which one is active?` carry a previously issued 15-minute HMAC-signed student-search pointer, scoped to the authenticated organization/user/role/session version. A follow-up `How much has he paid?` uses the existing finance reader but never chooses between multiple matching residents without identification. Expired or invalid context requires the name again. No browser localStorage or cross-session database memory is added.

Staff access is rechecked inside the API. Only OWNER/ADMIN/MANAGER can search student identities via this assistant tool. CARETAKER is directed to the authorized visitor register, rather than the full private student register. Data queries are always scoped to the server-authenticated organization. No registration, payment or visitor record is changed.

## Regression tests
`scripts/test-assistant-person-search.ts` covers both quoted Android messages, name matching, case-insensitive searches, variant wording, misspelled surname fallbacks, duplicate Davids, the meaning of `available`, no unauthorized financial/room-vacancy queries, gate-staff denial, end-to-end assistant routing and signed pronoun follow-up. The existing signed-context regression suite also checks that name pointers expire and cannot be replayed across users, organizations, roles or revoked sessions. The full Vercel build runs both alongside finance, tenant and security tests.

Release only on a passing full preview build followed by reviewed merge and matching production deployment. Signed-in phone testing against actual student records is still necessary before claiming the exact David account appears, because the CI fixtures are not proof of real records.