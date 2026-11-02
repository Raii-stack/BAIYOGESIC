# Sprint 2 CRM and Inventory Usability Review

Date: 2026-11-02
Scope: Customer Management and Inventory
Related issue: #60

## Review method

The walkthrough followed the customer and product list flows from initial loading through search/filtering, empty results, request failure, archive confirmation, blocked archive, successful archive, and restore. Automated interaction tests exercise the same keyboard and API paths in `CustomerManagementPage.test.tsx` and `InventoryPage.test.tsx`.

## Findings and resolution

| Area | Finding | Resolution |
| --- | --- | --- |
| Loading | Both directories already use table-shaped skeleton rows and `aria-busy` while requests are pending. | Retained and covered by existing tests. |
| Empty directory | The previous state used text only and gave the same guidance for an empty database and filtered-out results. | Added customer/product illustrations, a first-record action, and distinct "no matches" guidance with a single Clear filters action. |
| Request failure | Both pages already show an alert with the API message and a Try again action. | Retained; failure content is not replaced by the empty state. |
| Archive confirmation | Dialogs exposed names/descriptions but did not contain keyboard focus or return it to the invoking row action. | Cancel receives initial focus, Tab/Shift+Tab remain inside the dialog, Escape dismisses only when idle, and focus returns to the archive trigger. |
| Blocked archive | Customer and product APIs already return HTTP 409 when active sales reference the record. | The inline error remains in the open dialog and is included in `aria-describedby`. |
| Payment terms | The UI and API accept `60D`, but the original database check constraint only allowed `COD`, `30D`, and `45D`. | Added an idempotent migration that aligns the constraint with all four supported terms. |

## Walkthrough checklist

- Customer and product searches remain debounced before requesting the server.
- Payment-term, unit, and status filters reset pagination to page 1.
- Clear filters resets search, type/status filters, and pagination together.
- Users without create permission receive useful empty-state text without a create action.
- Archive dialogs announce the record, consequence, busy state, and any conflict returned by the API.
- Archive and restore actions remain hidden when the role lacks the corresponding permission.
- Tables retain horizontal overflow on narrow screens; empty-state content and dialog actions wrap within the existing responsive panel/modal widths.

## Verification

- `npm test -- src/pages/CustomerManagementPage.test.tsx src/pages/InventoryPage.test.tsx`
- `npm run test:integration -- --runInBand tests/integration/crm-inventory.test.js`
- `npm run verify:migrations`
- `npm run lint`
- `npm run build`

The targeted UI tests cover the illustrated filtered state, filter clearing, focus entry and loop, Escape dismissal, focus restoration, and HTTP 409 archive messaging for both modules.
The live integration runner additionally requires the repository's uncommitted `.env.test` credentials and a reachable test API; the self-contained CRM/inventory controller tests also run as part of `npm test`.
