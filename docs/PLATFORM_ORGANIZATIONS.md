# Organizations control-plane view

The first Organizations screen is intentionally read-only.

It reads existing Organization records only after `requireSuperAdmin()` succeeds and displays high-level counts for users, rooms, properties and subscriptions.

No cross-organization operational records are opened from this screen, and there are no edit, suspend, impersonate or delete actions. Those operations require explicit audited workflows in later phases.

This implementation adds no migration and does not depend on PR #21 completing the Property backfill; an existing organization may legitimately display zero properties until that migration is repaired.
