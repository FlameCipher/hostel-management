# HealthFix connector

StudentsHostels exposes a minimal read-only health contract at `GET /api/platform/healthfix`.

Authentication uses a dedicated `HEALTHFIX_CONNECTOR_SECRET` supplied through `x-healthfix-connector-secret`. It is deliberately separate from provisioning credentials.

The response contains only product/module health metadata. It does not expose tenant records, database errors, environment values, secrets, SQL, stack traces, customer identifiers, or MMAMBUGUA data.

Current checks are intentionally conservative:
- application endpoint availability
- database connectivity using `SELECT 1`
- provisioning is reported UNKNOWN until a safe independent check exists

HealthFix must treat UNKNOWN as unknown, never as healthy. Repair execution is not accepted by this endpoint.
