# Mama Mbugua Hostel Management System

A mobile-friendly hostel operations and rent-management application for Mama Mbugua Hostel. This first implementation checkpoint includes authentication, the management dashboard, the complete PostgreSQL data model, seeded accommodation rates, and application shells for the remaining operational modules.

## Current checkpoint

- Owner login and secure session cookie
- Responsive white and light-blue administration layout
- Dashboard with room, tenant, rent, payment, balance, and alert summaries
- PostgreSQL/Prisma models for rooms, students, guardians, occupancy, rent charges, payments, property, assets, users, semesters, and audit logs
- Seed data for the four approved accommodation types and 24 starter rooms
- Prepared routes for rooms, students, payments, check-in/check-out, student property, hostel assets, reports, users, and settings

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

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Set `DATABASE_URL` and a strong, randomly generated `SESSION_SECRET` in `.env`.

4. Generate the Prisma client and create the database tables:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

5. Add the starter organization, owner, rates, semester, and rooms:

   ```bash
   npm run db:seed
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000` in a browser.

## Development-only login

- Email: `owner@mamambugua.co.ke`
- Password: `ChangeMe123!`

Change this password before any demonstration involving real data and before deployment.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Create a production build |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration |
| `npm run db:seed` | Load starter hostel data |

## Project structure

- `src/app` — pages, layouts, and server actions
- `src/components` — shared application UI
- `src/lib` — authentication, database client, and temporary dashboard data
- `prisma/schema.prisma` — relational database design
- `prisma/seed.ts` — starter organization, account, rates, semester, and rooms

## Recommended implementation order

1. Rooms and accommodation rates
2. Students and guardian records
3. Check-in and room allocation
4. Semester charges, payments, balances, and receipts
5. Property and hostel asset inspections
6. Live reports, exports, and reminder integrations

## Production notes

- Use a managed PostgreSQL database with automated backups.
- Replace the development login and session secret.
- Enable HTTPS and secure hosting environment variables.
- Configure role permissions and audit all payment changes.
- Do not store M-Pesa credentials in source control.
