# Everyday hostel assistant questions

Room and student record questions use the authenticated hostel's deterministic readers. Leading polite wording, whitespace, curly contractions and room designators (`room no. 66`, `room #66`, `rm66`, `rom 66`) are recognized without fuzzy matching names or changing room numbers.

Room answers list recorded residents first and link directly to `/occupancy?q=<room>`. Person searches link to matching allocations. Room questions receive an answer before navigation; explicit open commands retain the navigation shortcut. Student accounts see examples about their own account and requests, while caretaker accounts see gate and room examples.

The client and server share the finance follow-up parser. The signed 15-minute conversation subject survives repeated balance/payment and room follow-ups. Direct named-account questions establish a subject too. Each request still validates the live user, role, session version and organization, then re-queries the appropriate register. An explicit different room starts a different subject. Unrelated replies and failed requests clear client context. Context is not persisted in browser storage or forwarded to the external model.

Missing or invalid pronoun context asks for the student or room again. An expired subject attached to a bare balance follow-up does not become an all-hostel total. Multi-room record requests ask for one room; shared-room balances remain separated per resident. Counting residents does not query payments. Every payment-date window still uses the existing Nairobi period resolver; charge balances and dated receipts retain their separate labels.

Examples covered by regression tests:

- “Could you tell me who's in room no. 66?” → “How much is the balance?” → “How much have they paid this month?” → “Which room are they in?”
- “What is the balance for Example Resident?” → “Show me their payments” → “Show me their room”.
- “Could you tell me who hasn't paid?”, “Who owes rent?” and “Show students who are yet to pay”.
- Switching to another explicit room, missing/tampered/expired/foreign-hostel subjects, multiple rooms, and a current caretaker role trying to reuse an owner subject.

`npm run test:assistant-knowledge` includes the conversation regressions. No schema migration, financial write, message delivery or permission change is introduced.

Student link requests (for example, “Give me a link for existing students to update their details”) resolve the authenticated organization's single published managed property domain and return a complete `/update-details` URL. The response includes Open page, Copy link and native Share controls, with selectable text if clipboard or sharing is unavailable. Only approved public student entry paths receive these controls; private record URLs and token-bearing links are excluded. Missing or ambiguous property domains ask for the website to be confirmed rather than guessing.

Explicit page commands such as “Open the payments page” use the current staff role's navigation catalogue, or the tenant's own page catalogue. The server rechecks the session before selecting a route. Link-sharing requests stay in the conversation; explicit requests to open the student update page navigate to the verified public address. Existing announcement preparation and confirmation remain separate. Regression checks run in `npm run test:assistant-navigation`.

The Payments receipt queue now uses responsive cards and a student-details sharing section. Each card separates receipt follow-up from the recorded payment, explains its delivery state, and directs missing-email cases to the hostel-specific public update link. Owner/Admin can review pending detail submissions or edit verified contacts. WhatsApp buttons explicitly prepare a draft; opening one never changes an unconfirmed send into a confirmed delivery.

The public student update flow uses three visible stages (find record, complete details, office review), readable mobile inputs, clearer email and emergency-contact instructions, and separate guidance for new accommodation applicants and portal access. Existing identity checks, approval requirements, duplicate protection, rent records and sending actions remain unchanged.
