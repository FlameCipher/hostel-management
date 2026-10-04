# Products, plans and entitlements

The first SYSTEM IN ONE catalogue screens are read-only and use the existing Product and Plan models.

- Products shows product identity, domain, active status, plan count and subscription count.
- Plans shows pricing fields, resource limits, custom-domain and white-label entitlements.
- No pricing is invented or seeded by this change.
- No plan limit is claimed as enforced until server-side entitlement checks are implemented.
- StudentsHostels remains Product #1 conceptually, but its database seed stays with the safely repaired migration path.
- No Prisma migration is added here and PR #21 remains untouched.
