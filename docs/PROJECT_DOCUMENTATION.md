# HOPE, Inc. ERP — Project Documentation

Last reviewed: **November 7, 2026**

## Project status

The live schedule, assignments, and task status are maintained in the **[HOPE ERP project tracker](https://docs.google.com/spreadsheets/d/1Ba4jr0MFxR92Dk7cSUoAcRFTePHkvwe8A-8e2kn9YvE/edit?usp=sharing)**.

<!-- issue-progress:start -->
> **Active development · Sprint 4 · Issue completion: 72.2% · Not yet release-ready**

### Issue progress

<div align="center">
  <img src="images/issue-progress.svg" alt="Project issue completion: 72.2% (65 of 90 issues closed)" width="900" />
</div>

| Closed | Open | Total | Completion |
| ---: | ---: | ---: | ---: |
| [65](https://github.com/Raii-stack/BAIYOGESIC/issues?q=is%3Aissue%20state%3Aclosed) | [25](https://github.com/Raii-stack/BAIYOGESIC/issues?q=is%3Aissue%20state%3Aopen) | 90 | **72.2%** |

Calculation: 65 closed ÷ (65 closed + 25 open) × 100 = 72.2%.

Automatically updated from GitHub issue states on **November 7, 2026**. Pull requests are excluded. The percentage includes every repository issue regardless of sprint, priority, or label, so it measures issue closure rather than release readiness.
<!-- issue-progress:end -->

### Feature status

| Feature area | Status | What works now | Main work remaining |
| --- | --- | --- | --- |
| Authentication & access | Ready | Login, session, logout, password changes, pending-approval self-registration, 15-minute single-use Gmail recovery links (`#token`), user management, role/department permission presets (auto-reset on role change), Helmet headers, and `no-store` API caching | Sprint 2–4 RBAC & auth regression sign-off |
| Workspace & notifications | Ready | Signed-in workspace preferences (`/settings` density, motion, alert category toggles) and persistent in-app notification inbox (`/notifications`) backed by transactional DB triggers, session-cached pagination, and 30-second polling | Final E2E regression sign-off |
| Customer management | Ready | Search, server pagination, sortable columns, create, edit, archive, restore, child-record delete protection, and 60-day payment term support | Sprint 2 QA verification (`#54`, `#57`, `#59`) |
| Inventory & pricing | Ready | Product CRUD, archive/restore, price history modal, active indicator, and dated price tier management | Sprint 2 QA verification (`#54`, `#57`, `#59`) |
| Human resources | Ready | Employees, dedicated departments and jobs management, job history career timeline, separation archiving, salary masking, and sensitive data redaction | Sprint 3 QA verification (`#62`, `#66`, `#68`) |
| Sales & payments | Ready | Sales entry, price lookup as of transaction date, multi-method payments, balances, child delete rules, and archive/restore | Sprint 4 QA & live-database verification (`#73`, `#74`, `#77`, `#78`, `#79`) |
| Dashboard | Ready | Role-aware module navigation, active employee presence, pending registration alerts, and live customer, product, order, and revenue KPI cards | Final regression testing |
| Reports | Ready | Seven system report queries/views, stored functions, parameter filtering, per-report access rights, and export/browser print | Sprint 4 report accuracy & E2E verification (`#79`, `#82`) |
| Audit log viewer | Ready | Superadmin audit log viewer with multi-filter search, diff inspector, single-roundtrip window pagination, and append-only immutability | Final sign-off & production monitoring (`#80`, `#82`) |

## Current priorities

1. Complete Sprint 2–4 QA regression and live-database end-to-end verification across CRM, Inventory, HR, Sales, and Reports (`#54`, `#57`, `#59`, `#62`, `#66`, `#68`, `#73`, `#77`, `#79`, `#82`).
2. Close remaining DevSecOps hardening, startup environment validation, and module architecture documentation tasks (`#119`, `#124`–`#126`, `#199`, `#201`, `#202`).
3. Finalize Sprint 3/4 Scrum deliverables, production release checklist, and final project report (`#63`, `#70`, `#84`).

See the [remaining sprint issues](agile/remaining-sprint-issues.md) and [QA bug log](qa/bug-log.md) for the detailed backlog. Some older planning notes describe earlier code states; the table above reflects the repository as reviewed on November 7, 2026.

## System overview

HOPE, Inc. ERP manages customers, products and price history, employees and job history, sales, payments, users, workspace notifications, and business reports. It follows a sale from customer and salesperson selection through effective-date pricing, payment recording, and outstanding-balance tracking.

```text
React + TypeScript browser app
            │  credentialed /api requests
            ▼
Express API (Helmet headers, auth, validation, permissions, rate limits)
            │
            ├── Supabase client
            └── PostgreSQL connection pool
                        │
                        ▼
    Data, rights, notifications, audit records, views, and indexes
```

### Request flow

1. The React app restores the user's session through `/api/auth/session`, loads workspace preferences and unread notifications from `/api/me/*`, and protects routes according to account status, role, module access, and action rights.
2. In local development, Vite proxies `/api` to Express on port `3000`. In production, Vercel rewrites `/api/*` to the serverless Express entry point.
3. Express applies `helmet` HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`), rate limiters, and `Cache-Control: no-store` headers across `/api`. Successful login creates a signed JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), which protected routes verify on the server.
4. Controllers validate input and query Supabase/PostgreSQL. List screens use server-side search and single-roundtrip window pagination; transactional flows use the PostgreSQL pool when request-level audit identity or notification triggers must share the connection.
5. Database migrations define schema changes, row-level security, demo data, sales balance calculations, employee preferences, transactional notifications, audit support, and covering performance indexes.

### Important business rules

- Self-registered accounts start as `pending` until approved by an administrator; changing a user's role resets custom permissions to the target role or department preset.
- Password recovery links expire after 15 minutes, store only SHA-256 token hashes in the database, can be redeemed once, and pass the raw token in the URL fragment (`#token=...`) rather than query parameters or API responses.
- Product prices are effective-dated; a sale uses the latest price effective on or before its transaction date.
- Customers, products, employees, lookups, and sales are archived instead of permanently deleted where history matters.
- A sale with payments cannot be archived, and overpayments are rejected.
- UI permission checks improve navigation, but the Express API remains the authorization boundary.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` | Sign in (`/create-account` redirects here) |
| `/register` | Employee self-registration (`pending` admin approval) |
| `/reset-password` | Password reset redemption (`#token=...`) |
| `/dashboard` | Role-aware workspace home with live KPIs and presence |
| `/profile` | Signed-in user profile and password change |
| `/settings` | Workspace preferences (density, motion, notification toggles) |
| `/notifications` | Persistent in-app notification inbox and history |
| `/customers` | Customer management |
| `/inventory` | Products and price history |
| `/departments` | Department management |
| `/employees` | Employee, department, and job management |
| `/employees/:employeeId` | Employee profile and career history timeline |
| `/sales` | Sales and payment management |
| `/sales/new` | Create a sale (`sales.add`) |
| `/reports` | Report selection, parameter filtering, and printing |
| `/users` | User management, permissions, registration approvals, and audit log viewer |

The API exposes matching groups under `/api/auth`, `/api/me`, `/api/dashboard`, `/api/customers`, `/api/products`, `/api/employees`, `/api/departments`, `/api/jobs`, `/api/users`, `/api/sales`, `/api/reports`, and `/api/audit-logs`. Health checks are available at `/health` and `/api/health`.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, React Router, Vite, Tailwind CSS, Vercel Analytics |
| Backend | Node.js 20+, Express 5, Helmet, `express-rate-limit`, Nodemailer (Gmail SMTP) |
| Database | PostgreSQL, Supabase |
| Authentication | `bcrypt`, signed JWT in an `HttpOnly` cookie, SHA-256 hashed single-use recovery tokens |
| Testing | Vitest, React Testing Library, Jest, Supertest, Playwright |
| Delivery | Vercel, GitHub Actions, `npm audit` overrides, TruffleHog secret scanning |

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
| `DATABASE_POOLER_HOST` | No | Optional Supabase session pooler host for IPv4-only environments |
| `JWT_SECRET` | Yes | Long random signing secret |
| `JWT_EXPIRES_IN` | No | JWT session lifetime; defaults to `1h` |
| `PORT` | No | Express port; defaults to `3000` |
| `CLIENT_ORIGIN` | No | Allowed frontend origin(s); defaults to `http://localhost:5173` |
| `VITE_API_PROXY_TARGET` | No | Local Vite proxy target; defaults to `http://localhost:3000` |
| `VITE_API_BASE_URL` | No | Absolute API origin when frontend and API are deployed separately |
| `GMAIL_USER` | For password reset | Gmail address used to send recovery emails |
| `GMAIL_APP_PASSWORD` | For password reset | Server-only Google App Password for `GMAIL_USER` |
| `APP_URL` | For password reset | Canonical frontend URL used in recovery links; defaults to `http://localhost:5173` |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, or `GMAIL_APP_PASSWORD` through a `VITE_` variable or commit a populated `.env` file.

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
| `npm start` | Start the Express API server without file watching |
| `npm run build` | Create the production frontend in `dist/` |
| `npm run preview` | Preview the production frontend build |
| `npm test` | Run frontend, component, and backend Vitest suites |
| `npm run test:unit` | Run Node/Jest unit and QA verification suites |
| `npm run test:integration` | Run database-backed integration tests; use an isolated test database |
| `npm run test:e2e` | Run Playwright browser specs (`playwright.config.js`) |
| `npm run lint` | Check JavaScript syntax with the project lint script |
| `npm run verify:migrations` | Validate migration filenames, order, and basic safety rules |

Transactional database verification scripts (`node scripts/verify-workspace-notifications.js` and `node scripts/verify-password-recovery.js`) also run inside `ROLLBACK` blocks against a configured `DATABASE_URL`. Checked-in Playwright smoke, layout, workspace-settings, and password-recovery specs run via `npm run test:e2e`, while full live-account ERP lifecycle E2E sign-off remains in progress (`#79`, `#82`).

## Verification snapshot

Verified on November 7, 2026 (local verification scripts and GitHub Actions CI on `main`):

| Check | Result |
| --- | --- |
| Frontend, component, and API tests (Vitest) | 74 files, 507 tests passed |
| Node/Jest unit and QA tests | 6 suites, 129 tests passed |
| JavaScript lint/syntax check | 44 JavaScript files verified |
| Migration verification | All 26 migrations passed |
| Dependency & secret security gates | 0 critical CVEs (`npm audit`); TruffleHog secret scan passed |
| Production build | Passed |

Database-backed integration tests (`npm run test:integration`) and full live-database browser E2E sign-off require a dedicated test database with seeded test accounts.

## Project structure

```text
api/                    Vercel serverless entry point
controllers/            Express request handlers and business operations
middleware/             Authentication, permissions, logging, audit, and errors
routes/                 API route definitions
lib/                    Shared backend validation, mail, and calculations
src/components/         Reusable React UI grouped by business area
src/pages/              Main authenticated ERP screens
src/lib/                Frontend API clients, RBAC, and shared helpers
src/types/              TypeScript domain types
supabase/migrations/    Ordered database changes (26 SQL migrations)
tests/e2e/              Playwright browser specs
tests/integration/      Database-backed API tests
tests/qa-unit/          Jest schema, security, and documentation checks
docs/                   Agile, database, design, feature, and QA records
scripts/                Development, CI, migration, and verification scripts
```

## Related documentation

- [Live project tracker](https://docs.google.com/spreadsheets/d/1Ba4jr0MFxR92Dk7cSUoAcRFTePHkvwe8A-8e2kn9YvE/edit?usp=sharing)
- [Employee workspace settings & notifications](EMPLOYEE_WORKSPACE.md)
- [Password recovery setup & security controls](PASSWORD_RECOVERY.md)
- [Remaining sprint issues](agile/remaining-sprint-issues.md)
- [Sprint 1 retrospective](agile/sprint1-retrospective.md)
- [Sprint 2 retrospective](agile/sprint2-retrospective.md)
- [QA test plan](qa/sprint1-test-plan.md)
- [RBAC test cases](qa/rbac-test-cases.md)
- [Sprint 1 integration & RBAC test report](qa/S1-TST-04-05-test-report.md)
- [Sprint 1 final QA verification report](qa/S1-TST-06-test-report.md)
- [QA bug log](qa/bug-log.md)
- [Database query optimization report](database/query-optimization-report.md)
- [Sprint 4 report queries specification](database/sprint4-report-queries-specification.md)
- [Sales child-delete integrity & audit log queries](database/sales-child-delete-integrity-and-audit-log.md)
- [HR schema constraints](database/hr-schema-constraints.md)
- [Sprint 3 HR indexes & disaster-recovery notes](database/sprint3-hr-indexes-and-disaster-recovery.md)
- [Sprint 4 migration rebuild & disaster-recovery verification](database/sprint4-rebuild-verification-and-disaster-recovery.md)
- [Sprint 1 usability review](design/sprint1-usability-review.md)
- [Final usability report](design/final-usability-report.md)

## Delivery workflow

Work is merged through the `test` branch before promotion to `main`. GitHub Actions run syntax checks, migration verification, automated tests, the production build, dependency auditing (`npm audit --audit-level=critical`), and TruffleHog secret scanning, while `.github/workflows/update-issue-progress.yml` refreshes the issue completion tracker from GitHub issue states. Deployments must provide all server-side environment variables in Vercel; `vercel.json` handles SPA and API rewrites.
