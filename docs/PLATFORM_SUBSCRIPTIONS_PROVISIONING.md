# Subscriptions, licensing and provisioning

## Hosted subscriptions
The control plane can read the existing Subscription model and show organization, product, plan, lifecycle status, trial and billing-period dates. The first screen is read-only.

## Dedicated/perpetual licences
A dedicated or perpetual licence is not the same as a hosted Subscription. The current schema does not yet model dedicated licence keys, deployment fingerprints, support terms or source-code ownership. The UI therefore does not pretend that it does.

## Provisioning safety gate
The provisioning screen is observational only. It checks basic catalogue counts and explicitly keeps the following blocked:
- PR #21 Property migration
- dummy second-organization isolation tests
- real Client #2 onboarding

No automatic organization creation, plan assignment, subscription activation, impersonation, billing mutation or database migration is introduced in this phase.
