# Auth and Password Test Cases (Sprint 1)

| ID | Title | Precondition | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-AUTH-01 | Register with verified email | Email not in use | Request an email code, then POST register with valid data and verificationCode | 201, pending employee created; approval required for login | P1 |
| TC-AUTH-02 | Register with invalid data | None | POST with duplicate email / missing field / weak password | 400 or 409, no user created | P1 |
| TC-AUTH-03 | Login with valid credentials | Active user exists | POST login | 200, session/token returned | P1 |
| TC-AUTH-04 | Login with invalid credentials | Active user exists | POST wrong password; POST unknown email | 401 both, identical error message | P1 |
| TC-AUTH-05 | Expired reset token rejected | Token with past expiry | Open reset link, then attempt POST reset with token + new password | Expired screen without password fields; API rejects reset, password unchanged | P1 |
| TC-AUTH-06 | Reused reset token rejected | Valid token | Use token twice | 1st: 200, 2nd: 400/401 | P1 |
| TC-AUTH-07 | Tampered/unknown token rejected | None | POST reset with altered token | 400/401 | P1 |
| TC-AUTH-08 | First-time setup cannot be bypassed | User flagged for first login | Log in, call protected API without setting password | 403 (or forced change), no data returned | P1 |
| TC-AUTH-09 | Soft-deleted user cannot log in | User with is_deleted = true | POST login with correct password | 401/403 | P2 |
| TC-AUTH-10 | Registration cannot bypass email verification | Unregistered email | Submit without a code, with another email's code, with an expired code, or after five incorrect guesses | 400; no employee or account created | P1 |
| TC-AUTH-11 | Verification resends are limited | Email code requested | Resend within 60 seconds or exceed three sends per hour | 429; no additional email sent | P1 |
| TC-AUTH-12 | Failed delivery can be retried | SMTP rejects delivery | Request a code, restore delivery, retry | Failure rolls back the code and send count; retry works | P1 |
