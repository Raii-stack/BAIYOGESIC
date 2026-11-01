# HOPE, Inc. ERP — Project Documentation

Last reviewed: **November 2, 2026**

## Project status

The live schedule, assignments, and task status are maintained in the **[HOPE ERP project tracker](https://docs.google.com/spreadsheets/d/1Ba4jr0MFxR92Dk7cSUoAcRFTePHkvwe8A-8e2kn9YvE/edit?usp=sharing)**.

<!-- issue-progress:start -->
> **Active development · Sprint 4 · Issue completion: 54.0% · Not yet release-ready**

### Issue progress

<div align="center">
  <img src="images/issue-progress.svg" alt="Project issue completion: 54.0% (47 of 87 issues closed)" width="900" />
</div>

| Closed | Open | Total | Completion |
| ---: | ---: | ---: | ---: |
| [47](https://github.com/Raii-stack/BAIYOGESIC/issues?q=is%3Aissue%20state%3Aclosed) | [40](https://github.com/Raii-stack/BAIYOGESIC/issues?q=is%3Aissue%20state%3Aopen) | 87 | **54.0%** |

Calculation: 47 closed ÷ (47 closed + 40 open) × 100 = 54.0%.

Automatically updated from GitHub issue states on **November 2, 2026**. Pull requests are excluded. The percentage includes every repository issue regardless of sprint, priority, or label, so it measures issue closure rather than release readiness.
<!-- issue-progress:end -->

### Feature status

| Feature area | Status | What works now | Main work remaining |
| --- | --- | --- | --- |
| Authentication & access | Ready | Login, session, logout, password changes, user management, role/module rights | Reconcile the visible reset-password page with the currently unavailable reset API |
| Customer management | Ready | Search, pagination, create, edit, archive, and restore | Final regression testing |
| Inventory & pricing | Ready | Product CRUD, archive/restore, effective-dated price history | Final regression testing |
| Human resources | Ready | Employees, departments, jobs, job history, salary permission checks | Final regression testing |
| Sales & payments | Ready | Sales entry, historical price lookup, totals, payments, balances, archive/restore | Full workflow and live-database verification |
| Dashboard | Partial | Role-aware module navigation and workspace details | Live customer, product, order, and revenue KPIs |
| Reports | Partial | Seven report views, permission filtering, sample tables, browser print/PDF | Live report API, database queries, date/employee filters, accuracy tests |
| Audit log viewer | Planned | Audit context and database indexes exist | Filtered API and superadmin interface |

## Current priorities

1. Connect all seven reports to live, permission-protected database queries.
2. Build the superadmin audit-log API and viewer.
3. Add live dashboard KPI statistics.
4. Run the complete integration/E2E regression and publish the final QA sign-off.
5. Resolve the reset-password route mismatch and remaining open QA findings.

See the [remaining sprint issues](agile/remaining-sprint-issues.md) and [QA bug log](qa/bug-log.md) for the detailed backlog. Some older planning notes describe earlier code states; the table above reflects the repository as reviewed on November 2, 2026.

## System overview

HOPE, Inc. ERP manages customers, products and price history, employees and job history, sales, payments, users, and business reports. It follows a sale from customer and salesperson selection through effective-date pricing, payment recording, and outstanding-balance tracking.

```text
React + TypeScript browser app
            │  credentialed /api requests
            ▼
Express API (authentication, validation, permissions, rate limits)
            │
            ├── Supabase client
            └── PostgreSQL connection pool
                        │
                        ▼
        Data, rights, audit records, views, and indexes
```

### Request flow

1. The React app restores the user's session through `/api/auth/session` and protects routes according to account status, role, module access, and action rights.
2. In local development, Vite proxies `/api` to Express on port `3000`. In production, Vercel rewrites `/api/*` to the serverless Express entry point.
3. Successful login creates a signed JWT in an `HttpOnly`, `SameSite=Lax` cookie. Protected API routes verify that cookie and enforce permissions on the server.
4. Controllers validate input and query Supabase/PostgreSQL. List screens use server-side search and pagination; transactional flows use the PostgreSQL pool when request-level audit identity must share the connection.
5. Database migrations define schema changes, row-level security, demo data, sales balance calculations, audit support, and performance indexes.

### Important business rules

- Product prices are effective-dated; a sale uses the latest price effective on or before its transaction date.
- Customers, products, employees, lookups, and sales are archived instead of permanently deleted where history matters.
- A sale with payments cannot be archived, and overpayments are rejected.
- UI permission checks improve navigation, but the Express API remains the authorization boundary.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` | Sign in |
| `/dashboard` | Role-aware workspace home |
| `/customers` | Customer management |
| `/inventory` | Products and price history |
| `/employees` | Employee, department, and job management |
| `/employees/:employeeId` | Employee profile and job history |
| `/sales` | Sales and payment management |
| `/sales/new` | Create a sale |
| `/reports` | Report selection and printing; currently sample data |
| `/users` | Admin user and rights management |
| `/profile` | Signed-in user profile |

The API exposes matching groups under `/api/auth`, `/api/customers`, `/api/products`, `/api/employees`, `/api/departments`, `/api/jobs`, `/api/users`, and `/api/sales`. Health checks are available at `/health` and `/api/health`.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, React Router, Vite, Tailwind CSS |
| Backend | Node.js 20+, Express 5 |
| Database | PostgreSQL, Supabase |
| Authentication | bcrypt, signed JWT in an HTTP-only cookie |
| Testing | Vitest, React Testing Library, Jest, Supertest, Playwright dependency |
| Delivery | Vercel, GitHub Actions, dependency and secret scanning |

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase/PostgreSQL project with the repository migrations applied
- Server-side Supabase and PostgreSQL credentials

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Fill in the required values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Server-side Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for auth administration | Privileged server-only key |
| `DATABASE_URL` | Yes for authenticated database routes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random signing secret |
| `PORT` | No | Express port; defaults to `3000` |
| `CLIENT_ORIGIN` | No | Allowed frontend origin; defaults to `http://localhost:5173` |
| `VITE_API_PROXY_TARGET` | No | Local Vite proxy target; defaults to `http://localhost:3000` |
| `VITE_API_BASE_URL` | No | Absolute API origin when frontend and API are deployed separately |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, or `JWT_SECRET` through a `VITE_` variable or commit a populated `.env` file.

### 3. Prepare the database

Apply every SQL file in `supabase/migrations/` in filename order. `supabase/seed.sql` contains optional development data. Verify the checked-in sequence with:

```bash
npm run verify:migrations
```

### 4. Start the application

```bash
npm run dev
```

This starts the frontend at `http://localhost:5173` and the API at `http://localhost:3000`. The project does not publish default login credentials; create or seed an approved account for the environment being used.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and API together |
| `npm run dev:frontend` | Start only Vite |
| `npm run api:dev` | Start only Express with file watching |
| `npm run build` | Create the production frontend in `dist/` |
| `npm run preview` | Preview the production frontend build |
| `npm test` | Run frontend/component Vitest tests |
| `npm run test:unit` | Run Node/Jest unit and QA tests |
| `npm run test:integration` | Run database-backed integration tests; use an isolated test database |
| `npm run lint` | Check JavaScript syntax with the project lint script |
| `npm run verify:migrations` | Validate migration filenames, order, and basic safety rules |

`npm run test:e2e` is defined, but a complete checked-in E2E suite remains part of the unfinished work.

## Verification snapshot

Verified locally on November 2, 2026:

| Check | Result |
| --- | --- |
| Frontend/component tests | 44 files, 238 tests passed |
| Node/Jest unit tests | 2 suites, 74 tests passed |
| JavaScript lint/syntax check | Passed |
| Migration verification | All 15 migrations passed |
| Production build | Passed |

Database-backed integration tests and a complete browser E2E workflow were not run for this snapshot because they require a dedicated test database. The build currently warns that the main JavaScript bundle is larger than 500 kB.

## Project structure

```text
api/                    Vercel serverless entry point
controllers/            Express request handlers and business operations
middleware/             Authentication, permissions, logging, audit, and errors
routes/                 API route definitions
lib/                    Shared backend validation and calculations
src/components/         Reusable React UI grouped by business area
src/pages/              Main authenticated ERP screens
src/lib/                Frontend API clients, RBAC, and shared helpers
src/types/              TypeScript domain types
supabase/migrations/     Ordered database changes
tests/integration/       Database-backed API tests
docs/                   Agile, database, design, and QA records
scripts/                Development, CI, migration, and project automation
```

## Related documentation

- [Live project tracker](https://docs.google.com/spreadsheets/d/1Ba4jr0MFxR92Dk7cSUoAcRFTePHkvwe8A-8e2kn9YvE/edit?usp=sharing)
- [Remaining sprint issues](agile/remaining-sprint-issues.md)
- [QA test plan](qa/sprint1-test-plan.md)
- [QA bug log](qa/bug-log.md)
- [Database query optimization report](database/query-optimization-report.md)
- [HR schema constraints](database/hr-schema-constraints.md)
- [Database disaster-recovery notes](database/sprint3-hr-indexes-and-disaster-recovery.md)
- [Sprint 1 usability review](design/sprint1-usability-review.md)

## Delivery workflow

Work is merged through the `test` branch before promotion to `main`. GitHub Actions run syntax checks, migration verification, automated tests, the production build, dependency auditing, and secret scanning. Deployments must provide all server-side environment variables in Vercel; `vercel.json` handles SPA and API rewrites.
