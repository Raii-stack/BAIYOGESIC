# Superadmin Audit Log Viewer Architecture & Multi-Filter Search Guide

## 1. Overview & Regulatory Compliance
The HOPE, Inc. ERP Audit Logging Subsystem provides an immutable, append-only historical record of all critical database operations, administrative rights changes, authentication lifecycles, and sensitive HR data access events. Designed to satisfy strict regulatory compliance frameworks (SOC 2, ISO 27001, and HIPAA), the subsystem guarantees complete non-repudiation and transparency.

### Key Guarantees
- **Append-Only Immutability:** Enforced via PostgreSQL trigger (`trg_block_audit_log_mutation`), preventing `UPDATE` and `DELETE` queries on `public.audit_log`.
- **Comprehensive Attribution:** Captures authenticated actor email/username, action timestamps, affected table name, primary/business record keys, and previous vs. updated JSON state snapshots.
- **Delta Diff Analysis:** The frontend UI provides an automated differential comparison between `old_values` and `new_values` to pinpoint modified attributes.

---

## 2. Audit Log Data Model

The primary ledger resides in `public.audit_log`:

| Column | Type | Description |
|---|---|---|
| `audit_id` | `BIGSERIAL` / `BIGINT` | Primary sequence key for the log entry |
| `table_name` | `VARCHAR(64)` | Target database table (e.g., `employee`, `jobhistory`, `sales`, `app_user_right`) |
| `action` | `VARCHAR(32)` | Operation classification: `ADD`, `EDIT`, `DELETE`, `ARCHIVE`, `RESTORE`, `VIEW_SALARY` |
| `record_key` | `TEXT` | Primary or business identifier of the affected record (e.g. `empno`, `transno`, `userId`) |
| `old_values` | `JSONB` | Snapshot of record state prior to modification (`null` on `ADD` / read audits) |
| `new_values` | `JSONB` | Snapshot of record state after modification (`null` on permanent `DELETE`) |
| `action_by` | `VARCHAR(128)` | Identity of the user or system actor executing the mutation |
| `action_at` | `TIMESTAMPTZ` | Microsecond-precision UTC timestamp of the event |

---

## 3. Database Triggers & Change Capture Mechanisms

1. **Automatic Row-Level Triggers:** For relational tables like `sales` and `salesdetail`, PostgreSQL triggers execute `audit_stamp()` procedures to capture cascading soft deletions and restorations.
2. **Application-Level Context Auditing (`withAudit`):** Higher-level mutations (user permissions, customer updates, employee record edits) use `withAudit(username, client)` in Express controllers to set session variables (`app.username`) and record structured `old_values` and `new_values`.
3. **Privileged Read Audits:** Accessing confidential compensation fields triggers non-blocking write events with action `'VIEW_SALARY'`.
4. **Tamper Prevention Trigger:**
   ```sql
   CREATE TRIGGER audit_log_prevent_mutation
     BEFORE UPDATE OR DELETE ON public.audit_log
     FOR EACH ROW
     EXECUTE FUNCTION public.trg_block_audit_log_mutation();
   ```

---

## 4. API Endpoint Specifications

### `GET /api/audit-logs`
Retrieves a paginated list of audit events matching composite search criteria.

- **Authentication:** Required (`access_token` session cookie or bearer token).
- **Authorization:** Exclusive to **Superadmin** (`requireSuperadmin` / role check). Unauthorized roles receive `HTTP 403 Forbidden`.

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `tableName` | `string` | No | Filter by table (e.g., `employee`, `sales`, `pricehist`) |
| `action` | `string` | No | Filter by action type (`ADD`, `EDIT`, `DELETE`, `ARCHIVE`, `RESTORE`, `VIEW_SALARY`) |
| `username` | `string` | No | Partial or exact match on `action_by` actor identity |
| `startDate` | `string (ISO)` | No | Lower bound filter on `action_at` (`YYYY-MM-DD` or full ISO) |
| `endDate` | `string (ISO)` | No | Upper bound filter on `action_at` (`YYYY-MM-DD` or full ISO) |
| `page` | `integer` | No | Page number (default: `1`, minimum: `1`) |
| `limit` | `integer` | No | Page size (default: `20`, maximum: `100`) |

#### Example Request
```bash
curl -X GET "https://erp.hope.inc/api/audit-logs?tableName=employee&action=EDIT&page=1&limit=10" \
  -H "Cookie: access_token=<valid-superadmin-token>"
```

#### Example Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "auditId": "1042",
        "tableName": "employee",
        "action": "EDIT",
        "recordKey": "00010",
        "actionBy": "superadmin@hope.inc",
        "actionAt": "2026-11-15T08:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### `GET /api/audit-logs/:id`
Retrieves full snapshot details including `old_values` and `new_values` for delta diff inspection.

```json
{
  "success": true,
  "data": {
    "log": {
      "auditId": "1042",
      "tableName": "employee",
      "action": "EDIT",
      "recordKey": "00010",
      "oldValues": {
        "deptcode": "SLS",
        "jobcode": "REP"
      },
      "newValues": {
        "deptcode": "MKT",
        "jobcode": "MGR"
      },
      "actionBy": "superadmin@hope.inc",
      "actionAt": "2026-11-15T08:30:00.000Z"
    }
  }
}
```

---

## 5. JSON Delta Diff Inspection & UI Component
In `AuditLogViewer.tsx`:
1. The user selects an audit record to inspect.
2. The UI computes a key-by-key delta comparing `oldValues` and `newValues`.
3. Added fields are highlighted in green, modified fields indicate `before -> after`, and removed attributes are highlighted in red.
4. Redaction filters ensure masked tokens and passwords remain `[REDACTED]` during display.

---

## 6. Performance & Indexing Strategies
To support millions of immutable log rows with sub-second filter queries, the following PostgreSQL indexes are maintained:

```sql
CREATE INDEX IF NOT EXISTS audit_log_table_action_at_idx
  ON public.audit_log (table_name, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_action_at_idx
  ON public.audit_log (action_by, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_at_idx
  ON public.audit_log (action, action_at DESC);
```
