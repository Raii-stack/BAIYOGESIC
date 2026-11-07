# Employee settings and inbox

Signed-in users can open Settings from their account menu. Preferences apply immediately and remain pending until Save settings succeeds. Account and security notifications cannot be disabled. Business notifications exclude the actor; personal notifications include their own account changes.

Inbox data, including loaded history pages, stays in the signed-in session across routes. Pagination is stored in the URL so browser Back returns to the same page without a loading flash or another request. The inbox checks every 30 seconds while visible and refreshes after successful local employee, user, sales, or product writes. Changed inbox results invalidate history quietly; unchanged results preserve it. Account changes and sign-out clear the cache. Notification ownership and current module access are checked on the server, including when opening a record link.

## Release order

1. Apply `supabase/migrations/20261106163612_employee_settings_and_notifications.sql` to the linked HOPE Inc ERP database.
2. Deploy the API and frontend together. The existing API remains compatible while the migration is applied.
3. Verify `/api/me/preferences` and `/api/me/notifications` require authentication, then check Settings and the inbox with a signed-in account.

The two new tables are backend-only: RLS is enabled, and anonymous/authenticated database roles have no table privileges. Notification triggers participate in the business transaction, so rollbacks leave no alerts. No historical events are backfilled.

## Verification

- `npx vitest run src controllers/workspace-controller.test.js controllers/activity-controller.test.js routes/dashboard-routes.test.js`
- `npx playwright test tests/e2e/workspace-settings.spec.js tests/e2e/ui-consistency.spec.js --workers=1`
- `npm run build`, `npm run lint`, and `npm run verify:migrations`
- `node scripts/verify-workspace-notifications.js`: uses the configured database, creates temporary fixtures inside a transaction, verifies real triggers and controllers, then rolls back all fixture/schema changes. If the migration is already installed it verifies the installed schema.

Browser tests use mocked APIs; the database verification separately exercises real PostgreSQL behavior. Mobile touch targets and operating-system reduced motion take priority over compact spacing and motion settings.
