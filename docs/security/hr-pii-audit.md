# HR Sensitive PII Protection & Privileged Salary Read Audit Trail

## 1. Overview
In compliance with data privacy regulations and security audit standards, HOPE Inc. ERP implements defense-in-depth controls around Human Resources personally identifiable information (PII) and compensation data:
1. **Case-Insensitive PII Redaction in Server Logs**: Automated redaction of sensitive HR fields across objects, nested structures, arrays, and HTTP request URLs.
2. **Privileged Salary Access Auditing**: Non-blocking audit trail generation in `public.audit_log` whenever authorized personnel view unmasked salary figures.

---

## 2. PII Sanitization & Log Masking (`middleware/logger.js`)
All HTTP request bodies, diagnostics, and structured logs pass through `sanitize()`. Keys are matched case-insensitively (`key.toLowerCase()`) against sensitive identifiers:

| Field Category | Redacted Keys | Masking Value |
|---|---|---|
| **Credentials & Auth** | `password`, `currentpassword`, `newpassword`, `password_hash`, `token_hash`, `token`, `verificationcode`, `access_token`, `secret`, `authorization`, `cookie` | `[REDACTED]` |
| **National IDs** | `ssn`, `tin` | `[REDACTED]` |
| **HR PII & Dates** | `salary`, `birthdate`, `sepdate` | `[REDACTED]` |

### Query Parameter Redaction (`redactUrlQuery`)
URL query strings logged by `requestLogger` strip sensitive parameters (`token`, `key`, `secret`, `password`) using URL query parsing, preventing accidental exposure of reset tokens or API keys in centralized server logs.

---

## 3. Privileged Salary Read Audit Trail (`controllers/employee-controller.js`)
When an authorized user with privileged compensation access (e.g., `Superadmin`, `Administrator`, or HR managers holding the `HR.view_salary` right) accesses employee compensation details via:
- `GET /api/employees/:empno`
- `GET /api/employees/:empno/job-history`

A non-blocking audit record is automatically dispatched into `public.audit_log`:

```sql
INSERT INTO public.audit_log
  (table_name, action, record_key, new_values, action_by, action_at)
VALUES
  ('employee', 'VIEW_SALARY', $1, $2::jsonb, $3, CURRENT_TIMESTAMP);
```

### Schema & Payload
- `table_name`: `'employee'`
- `action`: `'VIEW_SALARY'`
- `record_key`: The target employee's employee number (`empno`)
- `action_by`: Username or email of the authenticated requester
- `new_values`: JSON object containing:
  - `empno`: Target employee number
  - `accessed_at`: ISO 8601 access timestamp
  - `stamp`: Formatted audit stamp (`VIEW <username>`)

### Reliability Design
Salary read audit writes are **non-blocking**: if logging fails due to transient database contention, the read query succeeds and the error is logged to diagnostic output, avoiding user disruption while maintaining comprehensive accountability.
