# Payment Recording & Customer Transaction Balance Calculation Architecture

## 1. Overview & Architectural Principles
The Payment and Receivables Subsystem of HOPE, Inc. ERP decouples sales order generation from cash/credit collection events. Customers may settle transactions in full, execute partial progress payments, or settle outstanding balances across installment terms.

### Ledger States
Each sales order dynamically computes one of three balance statuses based on accumulated payment history:
1. **Unpaid:** Zero payments recorded (`paid_amount = 0`, `balance = total_amount`).
2. **Partial:** Partial payments recorded (`0 < paid_amount < total_amount`).
3. **Paid:** Saturated balance (`paid_amount >= total_amount`, `balance = 0.00`).

---

## 2. Mathematical Balance Formula & Precision
Transaction balances are computed deterministically across line items and recorded payment receipts:

$$\text{Gross Total} = \sum (\text{qty} \times \text{unit\_price})$$
$$\text{Total Paid} = \sum (\text{payment\_amount})$$
$$\text{Remaining Balance} = \max(0.00, \text{Gross Total} - \text{Total Paid})$$

### Decimal Rounding & Safeguards
- Currency calculations are strictly constrained to PostgreSQL `NUMERIC(12, 2)` arithmetic to prevent floating-point representation drift.
- Payment amounts must be strictly positive (`amount > 0`). Zero or negative payment entries are rejected with `HTTP 400 Bad Request`.
- **Overpayment Guard:** A payment submission that exceeds the remaining balance is rejected with `HTTP 400 Bad Request`:
  ```json
  {
    "success": false,
    "error": {
      "message": "Payment amount ($500.00) exceeds remaining balance ($350.00).",
      "statusCode": 400
    }
  }
  ```

---

## 3. Database Schema & Relational Integrity

### `public.sales` (Transaction Header)
```sql
CREATE TABLE public.sales (
  transno VARCHAR(20) PRIMARY KEY,
  custcode VARCHAR(10) NOT NULL REFERENCES public.customer(custcode),
  salesdate DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  stamp TEXT
);
```

### `public.payment` (Payment Receipts)
```sql
CREATE TABLE public.payment (
  payno VARCHAR(20) PRIMARY KEY,
  transno VARCHAR(20) NOT NULL REFERENCES public.sales(transno),
  paydate DATE NOT NULL,
  paymethod VARCHAR(20) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0.00),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  stamp TEXT
);
```

Supported payment methods include: `Cash`, `Check`, `Credit Card`, `Bank Transfer`, `Online`.

---

## 4. API Endpoints

### 4.1 Record Payment
`POST /api/sales/:transno/payments`

Submits a payment against a valid active transaction.

#### Request Headers
- `Content-Type: application/json`
- `Cookie: access_token=<valid-token>`

#### Request Payload
```json
{
  "paydate": "2026-11-15",
  "paymethod": "Credit Card",
  "amount": 250.00
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "payment": {
      "payno": "PAY-20261115-001",
      "transno": "TRX-00100",
      "paydate": "2026-11-15",
      "paymethod": "Credit Card",
      "amount": 250.00
    },
    "balance": 150.00,
    "status": "Partial"
  }
}
```

---

### 4.2 Get Sale Details with Payment History
`GET /api/sales/:transno`

Returns the order header, line details, and complete payment history with balance computation.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "sale": {
      "transno": "TRX-00100",
      "custcode": "CUST-01",
      "salesdate": "2026-11-01",
      "totalAmount": 400.00,
      "totalPaid": 250.00,
      "balance": 150.00,
      "status": "Partial",
      "payments": [
        {
          "payno": "PAY-20261115-001",
          "paydate": "2026-11-15",
          "paymethod": "Credit Card",
          "amount": 250.00
        }
      ]
    }
  }
}
```

---

## 5. Security & Access Control
- **Authentication:** All payment queries and mutation endpoints require an active session (`authenticate`, `requireActiveUser`).
- **Permissions:** Recording a payment requires the `Sales.edit` or `Sales.payments` right. Users lacking permission receive `HTTP 403 Forbidden`.
- **Deletion Protection:** Sales orders with associated payment history are locked against deletion (`HTTP 409 Conflict`), maintaining consistent balance ledgers.
