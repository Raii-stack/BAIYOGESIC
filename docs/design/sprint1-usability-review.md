# Sprint 1 Usability Review

**Project:** HOPE, Inc. ERP (BAIYOGESIC)  
**Review date:** 2026-10-21  
**Scope:** Login, Registration, Set/Reset Password, User Management, and Rights Modal.  
**Method:** Static review of routed React components, labels/roles/focus styles, Tailwind color values and breakpoints; contrast ratios calculated using WCAG relative luminance. Frontend tests/build are supporting evidence only. This is not a claim that browser/device, keyboard-only, screen-reader, or automated axe audits were performed.

## Summary

Source provides a responsive auth shell, labeled form controls, password visibility buttons, named user-row actions, and responsive admin panel/modal sizing. Open findings: light placeholders and some small gray text fail AA contrast; dialog focus is not consistently contained/restored; dense tables rely on horizontal scrolling on phone/tablet widths; and the standalone Registration screen is not reachable or functional in the current route map.

## Screen-by-screen review

| Screen | Findings and interaction review | Status |
|---|---|---|
| **Login** (`/`) | Email/password have labels and `aria-invalid`/described errors; password toggle is a named button with `aria-pressed`; auth failures are announced. DOM tab order is email → password → toggle → Forgot password → Sign in. Focus styles exist on link/toggle/submit. `slate-400` placeholder on white is 2.56:1 (fail). No Create account link is rendered. | Partial: semantics present; contrast fails; hands-on keyboard check pending. |
| **Registration** (`CreateAccountPage.tsx`, `/create-account`) | Source form has name/email/role/password/confirmation and client-side checks. `src/App.tsx` redirects `/create-account` to `/`; component is not mounted. `useFakeSubmission` simulates success without calling an API. | Not met as a reachable, working screen. Treat as an unrouted prototype, not a passing registration flow. |
| **Set/Reset Password** (`/reset-password`, forced-change dialog) | Reset form reads token from URL, checks minimum length/match, shows strength guidance and success/error toasts; missing-token state explains next step. Visibility toggles are keyboard-operable buttons. Forced-change modal focuses current-password and wraps Tab over a limited set of inputs/buttons, but has no Escape behavior or focus restoration. | Partial: form interactions are present; modal focus lifecycle incomplete; token scenarios not run against live API. |
| **User Management** (`/users`) | Labeled filters, semantic table headers, named account actions, pagination/current-page state, loading announcement. Table min-width is 1040px inside a non-focusable `overflow-x-auto` container. User side panel is full width on narrow screens and capped at `max-w-xl` (36rem); internal form scrolls. Escape closes panel, but focus is not moved, trapped, or restored. Placeholder contrast fails. | Partial: responsive sizing present; table keyboard access and panel focus behavior need work. |
| **Rights Modal** | Named `role=dialog`/`aria-modal`, labeled heading, close control, scroll body, labeled module checkboxes/selects and permission switches (`role=switch`, `aria-checked`); controls have focus styles. Escape closes unless saving. No initial focus, Tab trap, inert background, or focus restoration. Dialog is `max-w-5xl`/`92vh`; permission grid changes 1→2 columns at `sm`, 3 at `lg`; preset controls may crowd/wrap on mobile. | Partial: semantics present; keyboard containment absent; narrow layout needs hands-on check. |

## WCAG AA contrast audit

Thresholds used: **4.5:1** normal text (WCAG 1.4.3), **3:1** large text, and **3:1** non-text visual information needed to identify controls/states (1.4.11).

| Source foreground / background | Ratio | Result |
|---|---:|---|
| `slate-400` `#94a3b8` / white `#ffffff` | **2.56:1** | **Fail for normal text.** Shared auth and user-form placeholders. Placeholder text is not exempt. |
| `slate-500` `#64748b` / auth canvas `#edf1f5` | **4.19:1** | **Fail for normal text.** Small footer/support text on this background. |
| `slate-500` `#64748b` / white `#ffffff` | **4.76:1** | Passes for this pair; not transferable to tinted surfaces. |
| `slate-300` `#cbd5e1` / white `#ffffff` | **1.48:1** | **Fail if this border alone identifies a control boundary.** Review default fields; focus state is stronger. |
| `blue-700` `#1d4ed8` / white `#ffffff` | **6.70:1** | Color contrast passes for this pair; rendered ring thickness/background still requires visual review. |
| White `#ffffff` / `blue-800` `#1e40af` | **8.72:1** | Passes for primary-button text/fill. |

Ratios are calculated from source hex values. Opacity, disabled states, tinted surfaces, and every rendered component state were not evaluated; this is a targeted palette audit, not a complete pixel audit.

## Keyboard and interaction audit (source review)

- **Login:** Native input/link/button order is logical; toggle is keyboard-operable; field errors use `aria-invalid`/`aria-describedby`, auth failure uses `role="alert"`. Manually tabbing through the rendered page was **not performed**.
- **Registration:** Fields and shared password toggles are labeled/buttons in source, but route redirects and the form is not usable in the app. No real submit/keyboard journey exists.
- **Reset:** Inputs/toggles are keyboard controls; errors are associated with fields and API errors use toast announcements. Valid/expired/tampered-token flows were not run against an API.
- **User panel:** Labeled dialog and Escape handler, but no initial focus, focus trap, or focus restoration. `aria-modal` alone does not implement modal behavior.
- **Rights modal:** Labels and keyboard-operable checkbox/select/switch/buttons, close-button focus style, Escape handler; no initial focus, focus trap, inert background, or focus restoration.
- **Forced-password modal:** Initial focus and Tab wrap exist, but Escape/focus restoration are missing. Trap selector only includes `input, button:not([disabled])`; verify every focusable descendant is included and hidden/disabled controls are excluded.

## Responsive behavior: User Management and panels

Breakpoints describe authored source styles; no viewport was rendered manually.

| Surface | Mobile (<640px) | Tablet (640–1023px) | Desktop (≥1024px) | Finding |
|---|---|---|---|---|
| User filters | Stacked controls. | Two columns from `md`; table still wider than viewport. | Multi-column filters from `lg`. | Source adapts filter layout. |
| User table | `min-w-[1040px]`; horizontal pan. | Same fixed minimum width and scroll wrapper. | Fits only if available content width permits. | Most phone/tablet widths must pan. Scroll wrapper is not keyboard-focusable or accessibly named. |
| User side panel | `w-full`; viewport-width panel with vertical form scroll. | `w-full`, capped by `max-w-xl` (36rem). | Same capped right-side panel. | Width behavior is responsive; short landscape heights and action reachability need browser check. Focus management is a separate blocker. |
| Rights Modal | Viewport padding, body scroll, one-column permission grid; preset actions may wrap. | Two columns from `sm`. | Three columns from `lg`, max width 5xl. | Source adapts, but mobile density/overflow and focused-control visibility need hands-on testing. |

Related auth layouts: login/reset remain single-column at mobile/tablet; auth sidebar appears at `lg`. The unrouted registration prototype stacks name/password pairs below `sm`. These are source observations, not device test results.

## UI polish tickets

### POLISH-001 — Increase placeholder and muted-text contrast
- **Priority:** P1 (accessibility)
- **Affected:** Shared auth `Field`, user form fields, auth footer.
- **Finding:** `slate-400` on white is 2.56:1; `slate-500` on `#edf1f5` is 4.19:1.
- **Acceptance:** Choose colors at or above 4.5:1 for normal text on actual surfaces; verify placeholder, footer, disabled/error, and focus states.

### POLISH-002 — Complete modal focus lifecycle
- **Priority:** P1 (keyboard accessibility)
- **Affected:** Rights Modal, User Panel, forced-change password modal.
- **Finding:** Focus placement/containment/restoration is missing or incomplete; `aria-modal` does not supply it.
- **Acceptance:** Use tested native/shared dialog behavior: initial focus, Tab/Shift+Tab containment, inert background, safe Escape handling, focus restoration; cover nested dialogs and saving states.

### POLISH-003 — Make User Management table operable on narrow screens
- **Priority:** P1 (responsive/keyboard usability)
- **Affected:** User Management table, especially actions.
- **Finding:** 1040px minimum table inside non-focusable horizontal-scroll region.
- **Acceptance:** Prefer mobile record layout or make overflow region focusable, accessibly named and visibly scrollable. Verify 320px, 375px, tablet, landscape and 200% zoom; all actions/columns remain reachable.

### POLISH-004 — Resolve registration route and submission behavior
- **Priority:** P1 (functional consistency)
- **Affected:** `/create-account` and `CreateAccountPage`.
- **Finding:** Route redirects; component is unmounted and fake timer reports success without API call.
- **Acceptance:** Confirm admin-only vs self-service policy. Then remove/label the prototype and correct copy, or mount the authorized flow and connect/test real success, failure and pending-account outcomes. Never report fake success.

### POLISH-005 — Verify default form-control boundaries and focus indication
- **Priority:** P2 (visual accessibility)
- **Affected:** Auth/admin controls using `border-slate-300` on white.
- **Finding:** Boundary pair is 1.48:1; focus-blue pair is 6.70:1.
- **Acceptance:** Strengthen default boundaries or provide another persistent 3:1 visual cue where needed; preserve visible focus and check high-contrast, tinted, error and disabled states.

## Evidence and limitations

- `npx vitest run src` — **passed:** 10 test files, 33 tests. Tests use component/API mocks; they are not hands-on accessibility checks.
- `npm run build` — **passed**; Vite reported a minified JS chunk around 566 kB (above its 500 kB advisory threshold).
- Contrast checks — calculated from the source hex pairs above.
- Manual keyboard-only audit, browser checks at 320/375/tablet/desktop, screen-reader walkthrough, automated axe/WCAG scan, and real-device touch testing — **not performed**. Complete these before claiming WCAG AA compliance.
- Live API acceptance — **not verified** by this UI review.

## Acceptance status

- [x] Source review covers Login, Registration prototype/route, Set/Reset Password, User Management, and Rights Modal.
- [x] Source-level keyboard behavior and identified gaps documented across auth/admin modal surfaces.
- [x] Representative WCAG AA text/non-text contrast calculations documented, including failures.
- [x] User Management table and side-panel breakpoints reviewed from source.
- [x] Findings and prioritized UI polish tickets documented.
- [ ] Hands-on keyboard, screen-reader, browser viewport, and automated accessibility checks remain pending.
