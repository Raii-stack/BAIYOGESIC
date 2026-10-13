## Description
<!-- Provide a clear and concise summary of the changes introduced by this PR. -->
<!-- Explain *why* this change is being made if it's not immediately obvious. -->

## Linked Issue(s)
<!-- Link the issue(s) this PR resolves. Using "Closes #123" will automatically close the issue when merged. -->
Closes #

## Type of Change
<!-- Check the appropriate box (x) -->
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🛠️ Chore/Refactor (no production code change, e.g., documentation, testing, CI/CD)

---

## 📋 Definition of Done (Role Checklists)

### 💻 Developer / General
- [ ] My code follows the project's style guidelines and passes linting (`npm run lint`).
- [ ] I have performed a self-review of my own code.
- [ ] I have commented my code, particularly in hard-to-understand areas.
- [ ] There are no hardcoded secrets or plaintext passwords.

### 🗄️ DB Admin / Backend
- [ ] Any new API routes validate the user session and verify module permissions (View, Edit, Delete).
- [ ] Database migrations are idempotent and safely handle soft-deletes (no hard deletes).
- [ ] Any rights changes or sensitive actions are properly recorded via the `audit_log`.

### 🎨 UI/UX Designer (If UI changes are included)
- [ ] The implementation matches the Figma design system (colors, typography, spacing).
- [ ] The UI is fully responsive across standard breakpoints.
- [ ] Explicit UI states are handled: **Loading**, **Success**, **Error**, and **Empty**.
- [ ] Basic accessibility (a11y) is intact (keyboard navigation, aria-labels).

### 🧪 QA / Tester
- [ ] I have added/updated unit or integration tests that prove my fix is effective or my feature works.
- [ ] All new and existing tests pass locally.
- [ ] Edge cases and negative paths (e.g., expired tokens, insufficient permissions) have been considered and tested.

### 🔒 DevSecOps
- [ ] Required Vercel environment variables have been documented or updated.
- [ ] Vercel Preview deployment builds successfully without exposing sensitive data.

---

## 📸 Screenshots / Screen Recordings (if applicable)
<!-- For UI changes, please provide Before and After screenshots to help the reviewer. -->
| Before | After |
| ------ | ----- |
|        |       |

## 🧪 How to Test
<!-- Provide step-by-step instructions so the reviewer can manually test your changes. -->
1. Check out this branch: `git checkout my-branch-name`
2. Run local Supabase (if needed): `supabase start`
3. Log in as a [Superadmin/Admin/User]
4. Navigate to `/path/to/feature`
5. Verify that...