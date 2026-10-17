# MMAMBUGUA HOSTEL — direct emergency contact calling

The hostel owner supplied **0714 464 701** and **0722 634 013** as the hostel's emergency call numbers. They are displayed as one-tap, international-format `tel:+254714464701` and `tel:+254722634013` links. These are ordinary phone dialing links, **not** automatic calls, verified responders, phone-call receipts, WhatsApp automation or a guarantee someone answers.

## Where calls are visible

- Public student login even without activated account, and help on the published MMAMBUGUA property host.
- Authenticated student account / safety SOS / self-reported outing, late-return and arrival pages.
- Authenticated staff SOS queue and outing/late-return gate queue.
- Protected Owner/Admin gate and SOS operational readiness page.

The same single source of truth in `src/lib/hostel-emergency-contacts.ts` supplies the numbers everywhere. The component receives the trusted server session's `organizationId` (or the resolved published host's property organization for public pages), and returns **nothing** for other hostel operators and the shared directory. No phone numbers are added to other hostels' contracts. Kenya's public emergency numbers 999/112 remain separate and always visible in the call section. No system configuration or database migration is required.

## Acceptance limits

Students can call these numbers even when hostel SOS pilot is disabled or they lack an activated account. It is critical to verify that both numbers are answered by the intended designated hostel staff before advertising them as continuously monitored. No feature flags, security accounts, physical gate records or SOS status are modified. No call is placed without the visitor tapping a phone link and using their device dialer.

Tests `npm run test:hostel-emergency-contacts` validate both owner supplied numbers, `tel:` URI normalization, cross-hostel privacy, render output, page coverage and no automated SMS/GPS/dispatch. Full `npm run build` runs the test. A real Android/iPhone tap and availability test remain operational acceptance requirements.
