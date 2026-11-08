# Registration verification and password recovery email

Registration uses the same Gmail sender. `POST /api/auth/register/send-code` accepts `{ email }` and sends a six-digit code without creating an employee or account. `POST /api/auth/register` requires the names, email, password, and `verificationCode`; only a valid code creates an employee account with `status: pending`. HR/admin approval is still required before login.

Apply `supabase/migrations/20261108111301_registration_email_verification.sql` before deploying the registration changes. Codes expire after 10 minutes, allow five incorrect attempts, and can be resent after 60 seconds (three sends per email per hour). A resend replaces the previous code. Only a keyed hash is stored, bound to the normalized email; verification and account creation run in one transaction. The new table has RLS enabled and no `anon` or `authenticated` access. Existing accounts are unchanged.

Recovery uses the existing active account's work email and sends through Gmail SMTP over TLS. The API returns the same confirmation for active, missing, pending, or blocked accounts; it never returns a reset token. If Gmail is unavailable, the request fails and the user can retry.

Configure these server-only Vercel Production variables before deploying:

- `GMAIL_USER`: the Gmail mailbox that sends verification codes and recovery emails.
- `GMAIL_APP_PASSWORD`: its Google app password, with 2-Step Verification enabled. Never use the regular Google password or put this value in browser code or source control.
- `APP_URL`: `https://baiyogesic.vercel.app`, the trusted origin used in email links. Local development may use `http://localhost:5173`.

Apply `supabase/migrations/20261107110913_restrict_password_reset_tokens.sql` before deployment. It keeps reset-token storage private to backend database roles, in addition to existing RLS protection.

The sending mailbox and the employee's registered email must be real, working addresses. A connected Resend MCP server does not configure the website's mail delivery; this implementation uses Gmail, as selected.

Links expire after 15 minutes and can be redeemed once. Only a hash is stored. New emailed tokens use a separate hash namespace so older tokens exposed by the previous demo flow cannot be used. The token is carried in the URL fragment to keep it out of HTTP access logs and referrers.

The reset page checks `POST /api/auth/reset-password/validate` before showing password fields. Expired, used, and invalid links show separate messages and a button to request a new link. An active form switches to the expired screen when its deadline passes. Network failures offer a retry without claiming the link is expired; submission still rechecks the token on the server.

Requests for an already valid emailed link do not send another email. The success button remains disabled for 15 minutes, including closing and reopening the recovery dialog. Delivery failures roll back the token and leave retry available. Completing a reset invalidates the account's other unused reset tokens and rechecks active/unblocked status.

Existing signed-in sessions keep their normal expiry; this change does not add session revocation.

Verification:

```text
npx vitest run lib/password-reset-email.test.js tests/integration/auth-registration.test.js src/components/auth/ForgotPasswordModal.test.tsx src/components/pages/RegisterPage.test.tsx src/components/pages/ResetPasswordPage.test.tsx
node scripts/verify-password-recovery.js
npx playwright test tests/e2e/password-recovery.spec.js --workers=1
npm run build
```

The database verification creates fixtures in a transaction and always rolls them back. It captures email arguments without sending messages. Live SMTP authentication and delivery must be verified separately after private Gmail credentials are configured.
