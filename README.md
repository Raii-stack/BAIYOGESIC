# HOPE, Inc. ERP System (BAIYOGESIC)

Enterprise Resource Planning (ERP) platform developed for HOPE, Inc. The system integrates customer management, product catalog and price history tracking, human resources and job history, sales transactions with price-as-of-date calculation, payment processing, granular role-based access control (RBAC), audit logging, and reporting.

Developed for **Software Engineering 1**.

---

## Project Team and Roles

| Role | Team Member | Primary Responsibilities |
| --- | --- | --- |
| Scrum Master | Ryan James M. Gopio | Agile sprint orchestration, velocity tracking, impediment management, project board automation |
| Test Engineer | Prince Nelson J. Aguinaldo Jr. | Automated integration and regression test suites, defect verification, QA sign-off |
| UI/UX Developer | Alain Deiniel S. Montes | Frontend component architecture, design system standards, layout accessibility (WCAG AA) |
| Backend Engineer and DB Admin | Kathryn Chloe V. Silvestre | Database migrations, relational integrity constraints, API route controllers, query tuning |
| DevSecOps Engineer | Marron Beroy | CI/CD pipelines, security scanning, audit trail verification, environment configuration |

---

## Architecture and Technology Stack

The project follows a decoupled client-server architecture with an Express application backend and a React single-page application (SPA) frontend.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router 8
- **Backend:** Node.js (v20+), Express 5, Helmet, Cookie Parser, CORS
- **Database:** PostgreSQL via Supabase, pg (node-postgres), connection pooling
- **Authentication & Security:** JWT session management via HttpOnly cookies, bcrypt password hashing, audit context logging
- **Testing:** Vitest, React Testing Library, jsdom
- **CI/CD & Automation:** GitHub Actions, GitHub Projects v2 automation

---

## Core ERP Modules

### 1. Authentication and Access Control (RBAC)
- Multi-tier role permissions: Superadmin, Admin, and Employee.
- Session tokens stored in secure, HttpOnly cookies (`access_token`).
- Default password detection on first login forcing mandatory password update.
- Password reset workflow with time-limited tokens (15-minute validity).
- Granular per-module rights assignment across Customer, Product, HR, Sales, and Reports.
- Superadmin account protection (last remaining Superadmin cannot be demoted or disabled).

### 2. Customer Management (CRM)
- Customer directory with server-side pagination, status filtering, and payment terms (`COD`, `30D`, `45D`, `60D`).
- Wildcard customer search with frontend input debouncing (300ms).
- Soft deletion with referential integrity: archiving is blocked if active sales orders exist.

### 3. Inventory and Product Management
- Product catalog supporting item status filtering and categorization.
- Multi-tier price history tracking effective price points by date.
- Historical price lookup retrieves active unit price effective on or before the transaction date.
- Soft-archive protection prevents deletion of products with open sales transactions.

### 4. Human Resources and Personnel
- Employee directory with department and job title lookups.
- Chronological job history timeline capturing promotions, transfers, and compensation revisions.
- Confidential salary masking: compensation data is restricted to authorized personnel and redacted for standard employees.
- Employee separation tracking with soft-archive workflow.

### 5. Sales Transactions and Payment Processing
- Sequential transaction number generation (`SO-YYYYMM-XXXX`).
- Multi-line sales entry with automatic unit price lookup based on transaction date.
- Customer payment recording against sales transactions with real-time balance calculations.
- Transaction status indicators: Unpaid, Partial, and Paid.
- Overpayment prevention and soft-delete protections against orders with recorded payments.

### 6. Reports and Analytics
- Pre-built system reports: Product Master List, Active Employees, All Employees, Employee Job History, Top Customers, Top Products, and Top Sales.
- Configurable date ranges and Top N ranking limits.
- Optimized print stylesheets (`@media print`) for clean PDF generation and export.

### 7. Superadmin Audit Trail
- System-wide audit log tracking `INSERT`, `UPDATE`, and `DELETE` actions across core tables.
- Captured metadata: actor username, affected table, operation type, timestamp, and row state diffs.
- Read-only audit log viewer with multi-field search for compliance auditing.

---

## Project Structure

```
BAIYOGESIC/
├── .github/
│   ├── ISSUE_TEMPLATE/       # Standardized issue templates
│   ├── workflows/            # CI/CD and board automation workflows
│   └── PULL_REQUEST_TEMPLATE.md
├── controllers/              # Express route business logic and query handlers
│   ├── auth-controller.js
│   ├── customer-controller.js
│   ├── employee-controller.js
│   ├── product-controller.js
│   └── user-controller.js
├── docs/                     # Engineering documentation
│   ├── agile/                # Sprint tracking, retrospectives, and impediment logs
│   ├── database/             # Schema definitions and disaster recovery scripts
│   ├── design/               # Design specifications and usability reviews
│   └── qa/                   # Test plans, bug logs, and QA sign-off reports
├── lib/                      # Core backend utilities and database pool configuration
├── middleware/               # Express authentication, permission, and audit middleware
│   ├── audit-context.js
│   ├── auth.js
│   ├── error-handler.js
│   └── permissions.js
├── routes/                   # Modular API route definitions
│   ├── auth-routes.js
│   ├── customer-routes.js
│   ├── employee-routes.js
│   ├── product-routes.js
│   └── user-routes.js
├── scripts/                  # Project automation and field synchronization scripts
├── src/                      # React frontend source code
│   ├── components/           # Reusable UI components by feature domain
│   ├── hooks/                # Custom React application hooks
│   ├── layouts/              # Dashboard and authentication view layouts
│   ├── pages/                # Top-level page views and integration tests
│   ├── types/                # TypeScript interfaces and schema types
│   └── utils/                # Frontend validation and transformation helpers
├── supabase/
│   ├── migrations/           # Versioned PostgreSQL schema migrations
│   └── seed.sql              # Database initialization and demo records
├── server.js                 # Express application root entry point
├── package.json              # Project dependencies and script definitions
├── vite.config.ts            # Vite bundler and development proxy configuration
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- A Supabase PostgreSQL database instance

### Environment Configuration
Create a `.env` file in the project root:

```env
# Application Port and Environment
PORT=3000
NODE_ENV=development

# Client Origin (CORS)
CLIENT_ORIGIN=http://localhost:5173

# Supabase Credentials
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=<your-supabase-service-role-or-anon-key>

# Database Connection Pool
DATABASE_URL=postgresql://postgres:<password>@<db-host>:5432/postgres

# JWT Secret
JWT_SECRET=<your-jwt-secret-key>
```

For frontend local development, create `.env.local` if custom proxying is required:
```env
VITE_API_PROXY_TARGET=http://localhost:3000
```

### Installation and Execution

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run backend and frontend concurrently (development):**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

3. **Run services independently:**
   ```bash
   # Backend API server with watch mode
   npm run api:dev

   # Frontend development server
   npm run dev:frontend
   ```

4. **Build frontend for production:**
   ```bash
   npm run build
   ```

---

## Testing and Quality Assurance

The codebase uses Vitest alongside React Testing Library for unit and integration testing.

```bash
# Run all test suites
npm test

# Run tests in watch mode
npx vitest

# Run a specific test suite
npx vitest run src/pages/CustomerManagementPage.test.tsx
```

All pull requests must pass automated linting and the test suite before merging.

---

## Agile Workflow and Project Tracking

Sprint delivery is tracked via GitHub Projects v2:
- **Sprint Board:** [Sprint Plan for HOPE Inc.](https://github.com/users/Raii-stack/projects/5)
- Automated status progression:
  - Pull request opened with linked issue -> `In review`
  - Pull request merged -> `Done`
  - All prerequisite tasks completed -> `Ready` (assignee notified automatically)
