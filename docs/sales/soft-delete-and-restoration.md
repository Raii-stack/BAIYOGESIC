# Sales Soft Deletion, Restoration & Sale Rights Enforcement Guide

## 1. Overview & Data Retention Strategy
HOPE, Inc. ERP enforces a **strict logical soft deletion policy** across the Sales transaction domain. Physical `DELETE` statements on transactions (`public.sales`) and transaction line items (`public.salesdetail`) are prohibited to maintain tax compliance, ledger traceability, and data auditability.

Instead of purging records, orders are archived by setting `is_deleted = true` alongside an updated audit `stamp`. Archived orders are hidden from general sales lists and management reports, but remain retrievable and fully restorable by authorized personnel.

---

## 2. Payment Integrity Guard (HTTP 409 Conflict)
To prevent financial inconsistencies and orphaned payment records:
- **A sale order with ANY recorded payment cannot be archived.**
- Before executing a soft delete, the application and database check `public.payment`:
  ```sql
  SELECT 1 FROM public.payment WHERE transno = $1 LIMIT 1
  ```
- If one or more payments exist, the request is rejected with `HTTP 409 Conflict`:
  ```json
  {
    "success": false,
    "error": {
      "message": "Cannot delete a sale that has recorded payments. Reverse or remove payments before archiving this transaction.",
      "statusCode": 409
    }
  }
  ```

---

## 3. Cascading Soft Delete & Restoration Triggers

When a sales order header is marked as archived or restored, a database trigger automatically cascades the state change to all associated order items:

```sql
CREATE OR REPLACE FUNCTION public.trg_sales_cascade_soft_delete()
RETURNS trigger AS $$
BEGIN
    IF NEW.is_deleted AND NOT OLD.is_deleted THEN
        UPDATE public.salesdetail
        SET is_deleted = true
        WHERE transno = OLD.transno AND NOT is_deleted;
    ELSIF NOT NEW.is_deleted AND OLD.is_deleted THEN
        UPDATE public.salesdetail
        SET is_deleted = false
        WHERE transno = OLD.transno AND is_deleted;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Security & Permissions Matrix

All sales modification and soft-delete endpoints enforce Role-Based Access Control:

| Role | View Active Sales | Archive Sale (`DELETE`) | Restore Sale (`PATCH`) |
|---|---|---|---|
| **Superadmin** | Allowed | Allowed | Allowed |
| **Administrator** | Allowed | Allowed | Allowed |
| **Employee** | Allowed (if holds `Sales.view`) | Allowed only with `Sales.delete` right | Allowed only with `Sales.delete` right |
| **Guest / Anonymous** | Blocked (`401`) | Blocked (`401`) | Blocked (`401`) |

---

## 5. API Endpoints

### 5.1 Archive Sale Order
`DELETE /api/sales/:transno`

Marks the sales order and all linked line items as `is_deleted = true`.

#### Example Request
```bash
curl -X DELETE "https://erp.hope.inc/api/sales/TRX-00100" \
  -H "Cookie: access_token=<auth-token>"
```

#### Example Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Sale order TRX-00100 has been archived successfully.",
    "transno": "TRX-00100",
    "is_deleted": true
  }
}
```

---

### 5.2 Restore Archived Sale Order
`PATCH /api/sales/:transno/restore`

Reverses archiving, setting `is_deleted = false` on header and line items.

#### Example Request
```bash
curl -X PATCH "https://erp.hope.inc/api/sales/TRX-00100/restore" \
  -H "Cookie: access_token=<auth-token>"
```

#### Example Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Sale order TRX-00100 has been restored successfully.",
    "transno": "TRX-00100",
    "is_deleted": false
  }
}
```

---

## 6. Query Filtering & Active Views
Production API routes and reporting queries query active records by default:
```sql
SELECT * FROM public.sales WHERE is_deleted = false ORDER BY salesdate DESC;
```
To review archived records in the management interface, pass the query flag `archived=true`, which modifies the query predicate to `WHERE is_deleted = true`.
