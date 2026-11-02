# Sprint 3 HR Usability Review

Date: 2026-11-02  
Scope: Employee Directory, Job Timeline, and Department/Job management  
Related issue: #69

## Review method

The review followed the employee directory and profile flows at desktop, tablet, and mobile widths, then exercised the Jobs and Departments tabs with mouse and keyboard input. It also traced the API/controller behavior for salary visibility, job-history ordering, dated assignment changes, and archive conflicts before changing the UI.

## Findings and resolution

| Area | Finding | Resolution |
| --- | --- | --- |
| Job history | Both the expanded directory view and employee profile used dense tables, which made the relationship between assignments difficult to scan and forced a wide minimum width. | Replaced both presentations with one ordered timeline component. The newest assignment is labelled **Current**, entries retain effective date, job, department, salary, and audit data, and the layout adapts from four columns on desktop to three on tablet and two on mobile. |
| Salary confidentiality | The API already returns `null`/redacted salary values for users without salary access. The timeline needed to preserve that treatment. | The shared timeline renders a permission-labelled mask instead of formatting a withheld value. Users without `canViewHistory` also no longer receive a directory control that attempts to open job history. |
| HR tab navigation | Tabs had ARIA roles but all remained in the tab sequence and did not support standard keyboard navigation or identify their panels. | Added roving focus, Arrow Left/Right, Home, and End behavior plus `aria-controls`, `aria-labelledby`, and tab panels. The selected tab is the only tab in the normal Tab sequence. |
| Job/Department forms | Drawers opened without placing focus in the form, did not contain focus, and did not restore focus to the invoking action. | Initial focus now lands on the first editable field. Tab and Shift+Tab remain within the drawer, Escape closes it while idle, and focus returns to the action that opened it. |
| Archive confirmation | Job and Department confirmations exposed an alert dialog but did not contain or restore focus, and conflict text was not part of the dialog description. | Cancel receives initial focus, keyboard focus is trapped and restored, dismissal is disabled while saving, and HTTP 409 conflict text is connected with `aria-describedby`. |
| Visual consistency | HR dialogs mixed one-off focus and spacing behavior with the shared workspace tokens. | HR forms and confirmations now use the existing workspace controls, action styles, responsive drawer/modal padding, focus outline, and 44px mobile targets consistently. |

## Breakpoint walkthrough

- **Desktop (1024px and above):** timeline entries expose date, assignment, salary, and audit metadata in one row; directory actions remain aligned and the current assignment is visually distinct.
- **Tablet (768–1023px):** the assignment keeps primary emphasis while audit metadata wraps below it without horizontal scrolling.
- **Mobile (below 768px):** each entry becomes a compact two-column card; date and assignment span the full width, salary and audit metadata remain readable, and the timeline rail preserves chronology.
- Long job titles, department names, and audit stamps wrap within their cards instead of expanding the viewport.
- Salary masks are announced as hidden due to permissions and are never replaced with a numeric placeholder.

## Keyboard and permission checklist

- Arrow Left/Right cycles between Employees, Jobs, and Departments; Home/End jump to the first/last tab.
- Job and Department drawers announce their title and purpose, contain focus, close with Escape only while idle, and restore focus to their trigger.
- Archive dialogs announce the consequence and any active-history conflict returned by the API.
- Job-history controls are absent when the role lacks history rights.
- Salary is shown only when each API entry explicitly grants `canViewSalary`.
- Employee archive conflicts remain visible in the open dialog when the API returns HTTP 409 for active sales.

## Verification

- `npm test -- src/pages/EmployeeDirectoryPage.test.tsx src/pages/EmployeeProfilePage.test.tsx src/components/employees/EmployeeModals.test.tsx`
- `npm test`
- `npm run verify:migrations`
- `npm run lint`
- `npm run build`

The focused interaction coverage checks standard tab navigation, tab/panel relationships, initial focus, focus looping, Escape dismissal, focus restoration, history permission gating, timeline ordering cues, and salary redaction.
