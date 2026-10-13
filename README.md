# BAIYOGESIC

## Software Engineering 1

**Scrum Master:** Ryan James M. Gopio

**Test Engineer:** Prince Nelson J. Aguinaldo Jr.

**UI/UX Developer:** Alain Deiniel S. Montes

**BackEnd Engineer:** Kathryn Chloe V. Silvestre

**DevSecOps Engineer:** Marron Beroy


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