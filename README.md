# BAIYOGESIC

## Software Engineering 1

**Scrum Master:** Ryan James M. Gopio

**Test Engineer:** Prince Nelson J. Aguinaldo Jr.

**UI/UX Developer:** Alain Deiniel S. Montes

**BackEnd Engineer:** Kathryn Chloe V. Silvestre

**DevSecOps Engineer:** Marron Beroy

## Frontend development

The React frontend uses Vite and Tailwind CSS. Copy `.env.example` to `.env.local`
to configure the Express API. During local development, `/api` is proxied to
`http://localhost:3000` by default; set `VITE_API_PROXY_TARGET` if the backend
runs elsewhere. Set `VITE_API_BASE_URL` to the API origin when the frontend and
backend are hosted on different origins and the backend is configured for
credentialed CORS; otherwise, route `/api` through a same-origin reverse proxy.

Sign-in uses `POST /api/auth/login`. The frontend restores a session with
`GET /api/auth/session`, changes a default password with
`POST /api/auth/change-password`, and signs out with `POST /api/auth/logout`.
The backend sets and clears an HttpOnly `access_token` cookie, so the frontend
sends requests with credentials and keeps the signed-in user in React Context;
it does not expose or persist the token in JavaScript. If the backend returns
`mustChangePassword`, the user must complete the password-change dialog before
entering the workspace.
Public account creation is disabled until an administrator/HR-managed flow is available.
All workspace pages require an active session; User Management is limited to
administrator/admin roles. Customer, product, and employee APIs re-check the
account's current role, active status, and password-change requirement on each
request. Legacy email-only first-time password endpoints are disabled; recovery
uses a reset token. API failures are presented as safe, shared toast messages
instead of raw database/server errors.

Customer Management loads active and archived records from `GET /api/customers` with
debounced server-side search, status and payment-term filtering, and pagination. Administrators can
create, edit, and archive customers; admins can create and edit; employees and
users can view the directory. Payment terms use the database codes `30D`,
`45D`, and `COD`. If the database's direct hostname is IPv6-only in your
environment, set `DATABASE_POOLER_HOST` to the session pooler hostname shown
by Supabase; the server keeps the database password in `DATABASE_URL`.

Inventory & Product Management loads active and archived products from `GET /api/products`
with debounced server-side search, status and unit filtering, and pagination. Listed prices are the
latest matching price-history entries effective today or earlier; expanding
a product loads its full history from `GET /api/products/:prodcode/prices`.
Administrators can create, edit, and archive products; admins can create and
edit; employees and users can view. New products receive six-character `PX`
codes and a price entry effective on the Asia/Manila business date. Editing a price adds or updates that day's
entry. Archiving also archives price history and is blocked if active sales use
the product.

The Employee Directory reads real personnel and latest job-history records from
`GET /api/employees`, with server-side search, department, job, status, and
pagination filters. Employee profiles load live job history. Administrators and
admins can add and edit employee details and assignments; other roles can view
the directory without salary values. Employee creation does not create a login
account—the account-management flow remains separate.

Sales and User Management still use sample data. Their actions show a preview
notice and do not claim to persist changes until those modules are connected to
backend endpoints.

Run `npm install`, then use `npm run dev` to start the API and frontend together.
Run `npm test` for the frontend and helper tests
and `npm run build` to create the production bundle.

### Possible project structure
```
hope-erp/
├── .github/                # CI/CD & Project Management (DevSecOps & Scrum Master)
│   ├── workflows/          # GitHub Actions for linting, testing, and deployment security
│   ├── ISSUE_TEMPLATE/     # Standardized templates for bug reports and feature requests
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                   # Non-code Project Documentation
│   ├── agile/              # Sprint planning notes, retrospectives, burndown charts
│   ├── design/             # UI/UX handoff notes, design system documentation
│   └── qa/                 # Manual test plans, test cases, and sign-off reports
├── src/                    # Frontend & Serverless Code (Developer & UI/UX)
│   ├── app/                # Next.js App Router (Frontend pages and API routes)
│   │   ├── api/            # Vercel Serverless backend routes for Supabase interactions
│   │   ├── (auth)/         # Login, register, reset-password pages
│   │   ├── hr/             # Employee, department, and job routing
│   │   └── sales/          # Sales transaction and payment pages
│   ├── components/         # Reusable React UI Components
│   │   ├── common/         # Atomic elements (Buttons, Inputs, Modals)
│   │   └── features/       # Complex module-specific components (e.g., JobTimeline)
│   ├── hooks/              # Custom React hooks (e.g., usePermissions, useAuth)
│   ├── lib/                # Utilities and external service configurations
│   │   └── supabase/       # Supabase client initialization and helper functions
│   ├── styles/             # Global styles, Tailwind/Chakra configuration
│   └── types/              # TypeScript definitions (strongly typed DB schemas)
├── supabase/               # Database Infrastructure (DB Admin)
│   ├── migrations/         # Version-controlled SQL migration scripts (Tables, Views, RLS)
│   ├── seed.sql            # Demo data and initial superadmin seed (No real passwords)
│   └── config.toml         # Local Supabase development configuration
├── tests/                  # Automated Testing (Tester)
│   ├── e2e/                # End-to-end user flows (e.g., Playwright/Cypress)
│   ├── integration/        # Tests for API routes and database connections
│   └── unit/               # Isolated tests for UI components and helper functions
├── public/                 # Static assets (favicon, logos, empty-state illustrations)
├── .env.example            # Template for required environment variables (Safe for git)
├── .gitignore              # Files to ignore (e.g., .env.local, node_modules)
├── next.config.js          # Next.js framework and Vercel strict configurations
├── package.json            # Project dependencies and NPM script definitions
└── README.md               # Core setup instructions, sprint status, and local run guide
```
