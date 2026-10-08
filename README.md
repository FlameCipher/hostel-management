# Mama Mbugua Hostel Management System

A mobile-friendly hostel operations and rent-management application for Mama Mbugua Hostel. This first implementation checkpoint includes authentication, the management dashboard, the complete PostgreSQL data model, seeded accommodation rates, and application shells for the remaining operational modules.

## Current checkpoint

- Owner login and secure session cookie
- Responsive white and light-blue administration layout
- Dashboard with room, tenant, rent, payment, balance, and alert summaries
- PostgreSQL/Prisma models for rooms, students, guardians, occupancy, rent charges, payments, property, assets, users, semesters, and audit logs
- Seed data for the four approved accommodation types and 24 starter rooms
- Database-backed room register with search, filters, rate visibility, capacity, occupants, status, and audited add/edit workflows
- Prepared routes for students, payments, check-in/check-out, student property, hostel assets, reports, users, and settings
  Dashboard figures are currently presentation data. They will be replaced with live database queries as each operational module is implemented.

## Technology

- Next.js 16 with the App Router
- React 19 and TypeScript
- PostgreSQL
- Prisma ORM 7
- Tailwind CSS 4
- JWT-backed HTTP-only session cookies

## Local setup

Prerequisites: Node.js 20.9 or newer and a running PostgreSQL database.

1. Install dependencies:

```
npm install
```

2. Create the local environment file:

```
cp .env.example .env
```

3. Set `DATABASE_URL` and a strong, randomly generated `SESSION_SECRET` in `.env`.
4. Generate the Prisma client and create the database tables:

```
npm run db:generate
npm run db:migrate -- --name init
```

5. Add the starter organization, owner, rates, semester, and rooms:

```
npm run db:seed
```

6. Start the development server:

```
npm run dev
```

Open `http://localhost:3000` in a browser.

## Development-only login

- Email: `owner@mamambugua.co.ke`
- Password: `ChangeMe123!`
  Change this password before any demonstration involving real data and before deployment.

## Useful commands

CommandPurpose`npm run dev`Start the local development server`npm run lint`Run ESLint`npm run typecheck`Check TypeScript types`npm run build`Create a production build`npm run db:validate`Validate the Prisma schema`npm run db:generate`Regenerate the Prisma client`npm run db:migrate -- --name <name>`Create and apply a development migration`npm run db:seed`Load starter hostel data

## Project structure

- `src/app` — pages, layouts, and server actions
- `src/components` — shared application UI
- `src/lib` — authentication, database client, and temporary dashboard data
- `prisma/schema.prisma` — relational database design
- `prisma/seed.ts` — starter organization, account, rates, semester, and rooms

## Recommended implementation order

1. Students and guardian records
2. Check-in and room allocation
3. Semester charges, payments, balances, and receipts
4. Property and hostel asset inspections
5. Live reports, exports, and reminder integrations

## Production notes

- Use a managed PostgreSQL database with automated backups.
- Replace the development login and session secret.
- Enable HTTPS and secure hosting environment variables.
- Configure role permissions and audit all payment changes.
- Do not store M-Pesa credentials in source control.

## Operating currencies

Owners choose the workspace currency in Setup or Settings before creating rates or financial records. All properties within that organization share one ledger currency. Different operating currencies require separate workspaces; there is no foreign-exchange conversion. The platform’s US$40 setup price and manual M-Pesa payment process remain separate from tenant rent.

Existing amounts and currency snapshots are backfilled as KES. The migration widens monetary decimals to `(15,3)` without converting values. Database triggers permanently lock currency when the first pricing or financial record is inserted, preserve currency on individual ledger records, and reject incorrect currency or unsupported fractional units. Changing a currency with old financial data is deliberately unsupported. Deploy the additive migration before the new application code; older code continues to work for existing KES organizations. Once non-KES workspaces exist, do not roll back to code that assumes KES.

`src/lib/currencies.json` is a pinned snapshot of the SIX ISO 4217 current currency list published 2026-09-17, excluding fund/metal/accounting units. Source: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml . It includes currencies with zero, two and three minor-unit digits. Update both the registry and database checks through a reviewed migration when the list changes. This is currency formatting support, not a claim of international regulatory certification.

Payment balances use integer minor units. Rent proration rounds each segment in the selected currency. Statements and CSV exports explicitly identify the currency; PDF and verification receipts use the payment’s saved currency. Kenyan M-Pesa CSV imports are KES-only. Record other payments manually in the operating currency; no payment collection integration is enabled by this feature.

Run `npm run test:currency` and `npm run test:rent` for focused arithmetic checks. Currency changes and test fixture writes must never be run against customer records merely to verify a release.
