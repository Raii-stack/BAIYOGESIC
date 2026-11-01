<!--
PULL REQUEST TITLE CONVENTION:
Follow the conventional PR naming standard recognized by automated review:
  feat(dashboard): live KPI statistic cards and role-based quick actions (Closes #167)
-->

## Description
This pull request implements the live Dashboard metric KPI summary cards and role-sensitive Quick Actions specified in Student Guide §3.2 (Figures 6, 7, 8).

Key highlights:
- **Backend Metric Aggregation (`GET /api/dashboard/stats`)**: Implemented in `controllers/dashboard-controller.js` and `routes/dashboard-routes.js`. Executes a single consolidated SQL query calculating live counts and revenue sums (`customers`, `products`, `openOrders`, and `revenue`) from live tables and views (`public.customer`, `public.product`, and `public.sales_balance_view`), leveraging existing covering indexes (`customer_active_kpi_idx`, `product_active_kpi_idx`, `sales_active_kpi_idx`).
- **In-Memory Cache TTL**: Added a 5-second in-memory cache TTL (`STATS_CACHE_TTL_MS`) to protect the database against load spikes during concurrent visits, with query-parameter bypass (`?refresh=true`) for manual refresh.
- **Frontend Dashboard Statistics API Client (`src/lib/dashboard-api.ts`)**: Built an API client with robust error handling and formatting utilities (`formatCurrencyStat` and `formatIntegerStat`) formatting integers (e.g. `1,248`, `386`, `94`) and compact currency (e.g. `$84.2k`, `$1.5m`, `$0`, `$1m`).
- **Dashboard UI Header & Quick Actions (`src/components/pages/DashboardPage.tsx`)**:
  - Displays a responsive 4-card metric KPI grid with loading skeleton states (`animate-pulse`) while metrics fetch.
  - Adds Quick Action shortcuts ("+ New Customer", "+ New Product", "+ New Sale") that evaluate granular user permissions via `src/lib/rbac.ts`. Authorized actions link to `/customers`, `/inventory`, and `/sales/new`, while unauthorized actions are visibly greyed out and disabled per Guide Figure 8.
  - Reactive `useEffect` dependencies `[user?.userId, user?.mustChangePassword]` ensure metrics fetch seamlessly when users transition from mandatory password changes to active sessions.

## Linked Issues
Closes #167

## Type of Change
- [ ] Bug fix (`bug` / `fix` - non-breaking change resolving an issue or defect)
- [x] New feature (`new feat` / `feat` - non-breaking change adding new functionality)
- [ ] Breaking change (modification that alters existing functionality or interfaces)
- [ ] Refactor / Maintenance (`chore` / `refactor` / `perf` / `style` - code improvements or tooling without functional change)
- [ ] Testing & CI (`test` / `ci` - adding or updating tests or pipeline automation)
- [ ] Documentation (`docs` - documentation updates)

---

## Definition of Done

### General and Code Quality
- [x] Code follows project style guidelines and passes automated lint checks (`npm run lint`).
- [x] Self-review conducted prior to submitting for peer review.
- [x] Code is documented where appropriate, especially complex logic.
- [x] Verified that no secrets, credentials, or plaintext passwords are committed.

### Database and Backend
- [x] API routes enforce authentication, session validation, and granular role permissions (View, Edit, Delete).
- [x] Database migrations are idempotent and enforce referential integrity and soft-delete policies.
- [x] Rights modifications and sensitive state transitions are recorded in `audit_log`.

### User Interface and User Experience
- [x] Visual implementation matches design system specifications (typography, colors, spacing).
- [x] Layout is responsive across desktop, tablet, and mobile viewport breakpoints.
- [x] Explicit UI states are handled: loading, success, error, and empty states.
- [x] WCAG AA accessibility standards are met (contrast ratios, keyboard focus navigation, ARIA attributes).

### Quality Assurance and Testing
- [x] Added or updated automated unit/integration tests verifying the change.
- [x] All automated tests pass locally (`npm test`).
- [x] Negative paths and edge cases (unauthorized roles, input validation boundaries, conflicts) are covered.

### Security and Deployment
- [x] Environment variables and configuration updates are documented.
- [x] Preview deployments build successfully with clean build logs.

---

## Visual Evidence (if applicable)
| Before | After |
| ------ | ----- |
| Workspace welcome text and module tiles only; missing top KPI metric summary cards and quick action shortcuts. | 4-card metric grid (Customers, Products, Open Orders, Revenue) with loading skeletons + Quick Action buttons (+ New Customer, + New Product, + New Sale) with unauthorized buttons disabled/greyed out. |

## Verification Steps
1. Check out the branch: `git checkout issue-167`
2. Start the development environment: `npm run dev`
3. Authenticate with appropriate role credentials (Superadmin / Admin / Employee)
4. Navigate to `/dashboard`:
   - Verify 4 KPI cards render: Customers (e.g. `1,248`), Products (e.g. `386`), Open Orders (e.g. `94`), and Revenue (e.g. `$84.2k`).
   - Verify loading skeletons display while stats are fetching.
   - Verify "+ New Customer", "+ New Product", and "+ New Sale" render as active buttons/links for users with appropriate add rights.
   - For an employee without specific add rights, verify unauthorized quick action buttons are disabled and greyed out.
5. Verify endpoint via curl:
   ```bash
   curl -b cookies.txt http://localhost:3000/api/dashboard/stats
   ```
   Confirm JSON response returns `{ success: true, data: { customers, products, openOrders, revenue } }`.
