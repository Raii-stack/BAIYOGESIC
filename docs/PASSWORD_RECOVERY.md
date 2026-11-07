# Password recovery email

Recovery uses the existing active account's work email and sends through Gmail SMTP over TLS. The API returns the same confirmation for active, missing, pending, or blocked accounts; it never returns a reset token. If Gmail is unavailable, the request fails and the user can retry.

Configure these server-only Vercel Production variables before deploying:

- `GMAIL_USER`: the Gmail mailbox that sends recovery emails.
- `GMAIL_APP_PASSWORD`: its Google app password, with 2-Step Verification enabled. Never use the regular Google password or put this value in browser code or source control.
- `APP_URL`: `https://baiyogesic.vercel.app`, the trusted origin used in email links. Local development may use `http://localhost:5173`.

Apply `supabase/migrations/20261107110913_restrict_password_reset_tokens.sql` before deployment. It keeps reset-token storage private to backend database roles, in addition to existing RLS protection.

The sending mailbox and the employee's registered email must be real, working addresses. A connected Resend MCP server does not configure the website's mail delivery; this implementation uses Gmail, as selected.

Links expire after 15 minutes and can be redeemed once. Only a hash is stored. New emailed tokens use a separate hash namespace so older tokens exposed by the previous demo flow cannot be used. The token is carried in the URL fragment to keep it out of HTTP access logs and referrers.

Requests for an already valid emailed link do not send another email. The success button remains disabled for 15 minutes, including closing and reopening the recovery dialog. Delivery failures roll back the token and leave retry available. Completing a reset invalidates the account's other unused reset tokens and rechecks active/unblocked status.

Existing signed-in sessions keep their normal expiry; this change does not add session revocation.

Verification:

```text
npx vitest run lib/password-reset-email.test.js tests/integration/auth-registration.test.js src/components/auth/ForgotPasswordModal.test.tsx src/components/pages/ResetPasswordPage.test.tsx
node scripts/verify-password-recovery.js
npx playwright test tests/e2e/password-recovery.spec.js --workers=1
npm run build
```

The database verification creates fixtures in a transaction and always rolls them back. It captures email arguments without sending messages. Live SMTP authentication and delivery must be verified separately after private Gmail credentials are configured.
