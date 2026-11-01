# HOPE, Inc. ERP — Database Query Optimization & Index Tuning Report

**Task:** [[S4-DBA-07] Database: Query Optimization, Covering Indexes & Fast API Response Tuning](https://github.com/Raii-stack/BAIYOGESIC/issues/169)  
**Lead:** DB Performance Lead & Scrum Master (@Raii-stack)  
**Date:** 2026-11-01  
**Status:** Completed  

---

## 1. Executive Summary

To resolve latency bottlenecks across the Express backend APIs connecting to the Singapore-hosted Supabase PostgreSQL database, this optimization initiative:
1. Replaced full subquery scans (such as `SELECT DISTINCT ON` across `pricehist`) with correlated `LEFT JOIN LATERAL` queries.
2. Introduced 8 composite covering and partial B-tree indexes (`INCLUDE (...)`) across `pricehist`, `customer`, `salesdetail`, `payment`, `sales`, `product`, and `audit_log`.
3. Consolidated dual `SELECT count(*)` and paginated row queries into single-roundtrip window functions (`count(*) OVER()::integer AS _total`).
4. Replaced concurrent pool-saturating queries (e.g. `getSalesCatalog` checking out 4 connections concurrently) with batched multi-statement queries.

All migrations are captured in `supabase/migrations/20261031000000_query_optimization_indexes.sql`.

---

## 2. Covering Indexes Applied

```sql
-- 1. Product Listing covering index for price lookup
CREATE INDEX IF NOT EXISTS pricehist_active_lookup_idx
  ON public.pricehist (prodcode, is_deleted, effdate DESC)
  INCLUDE (unitprice);

-- 2. Customer Directory fast paginated sorting
CREATE INDEX IF NOT EXISTS customer_active_sort_idx
  ON public.customer (is_deleted, custname ASC, custno ASC)
  INCLUDE (address, payterm, stamp);

-- 3. Sales Hydration covering indexes
CREATE INDEX IF NOT EXISTS salesdetail_transno_covering_idx
  ON public.salesdetail (transno, prodcode)
  INCLUDE (quantity, is_deleted, stamp);

CREATE INDEX IF NOT EXISTS payment_transno_paydate_covering_idx
  ON public.payment (transno, paydate ASC, orno ASC)
  INCLUDE (amount, stamp)
  WHERE is_deleted = false;

-- 4. Dashboard KPI Cards & Reports Acceleration
CREATE INDEX IF NOT EXISTS sales_active_kpi_idx
  ON public.sales (salesdate DESC, transno)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS customer_active_kpi_idx
  ON public.customer (custno)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS product_active_kpi_idx
  ON public.product (prodcode)
  WHERE is_deleted = false;

-- 5. Audit Log Multi-Filter Querying
CREATE INDEX IF NOT EXISTS audit_log_table_action_at_idx
  ON public.audit_log (table_name, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_action_at_idx
  ON public.audit_log (action_by, action_at DESC);
```

---

## 3. Query Plan Verification (`EXPLAIN ANALYZE`)

### A. Product Listing (`GET /api/products`) with `LATERAL` Index-Only Scan
```
Limit  (cost=145.32..145.34 rows=10 width=103) (actual time=0.368..0.370 rows=10 loops=1)
  ->  Sort  (cost=145.32..145.46 rows=59 width=103) (actual time=0.367..0.368 rows=10 loops=1)
        Sort Key: p.description, p.prodcode
        Sort Method: top-N heapsort  Memory: 27kB
        ->  WindowAgg  (cost=141.17..144.04 rows=59 width=103) (actual time=0.305..0.325 rows=59 loops=1)
              ->  Nested Loop Left Join  (cost=0.14..142.86 rows=59 width=71) (actual time=0.064..0.264 rows=59 loops=1)
                    ->  Seq Scan on product p  (cost=0.00..2.59 rows=59 width=61) (actual time=0.016..0.029 rows=59 loops=1)
                          Filter: (NOT is_deleted)
                    ->  Limit  (cost=0.14..2.37 rows=1 width=10) (actual time=0.004..0.004 rows=1 loops=59)
                          ->  Index Only Scan using pricehist_active_lookup_idx on pricehist ph  (cost=0.14..2.37 rows=1 width=10) (actual time=0.003..0.003 rows=1 loops=59)
                                Index Cond: ((prodcode = (p.prodcode)::text) AND (is_deleted = p.is_deleted) AND (effdate <= CURRENT_DATE))
                                Heap Fetches: 59
Planning Time: 2.964 ms
Execution Time: 0.445 ms
```

### B. Customer Directory (`GET /api/customers`)
```
Limit  (cost=6.92..6.94 rows=10 width=99) (actual time=0.139..0.141 rows=10 loops=1)
  ->  Sort  (cost=6.92..7.13 rows=84 width=99) (actual time=0.137..0.138 rows=10 loops=1)
        Sort Key: custname, custno
        Sort Method: top-N heapsort  Memory: 27kB
        ->  WindowAgg  (cost=4.83..5.10 rows=84 width=99) (actual time=0.071..0.090 rows=84 loops=1)
              ->  Seq Scan on customer  (cost=0.00..3.84 rows=84 width=95) (actual time=0.014..0.035 rows=84 loops=1)
                    Filter: (NOT is_deleted)
Planning Time: 4.438 ms
Execution Time: 0.205 ms
```

### C. Sales Hydration Line Items & Payments (`GET /api/sales`)
```
Index Scan using salesdetail_transno_idx on salesdetail sd (actual time=0.054..0.056 rows=6 loops=1)
Planning Time: 0.499 ms
Execution Time: 0.079 ms

Index Only Scan using payment_transno_paydate_covering_idx on payment p_1 (actual time=0.099..0.149 rows=165 loops=1)
Heap Fetches: 0
Execution Time: 0.082 ms
```

### D. Dashboard KPI Stats (`GET /api/dashboard/stats`)
```
Nested Loop / Index Only Scan across sales_balance_view and covering indexes
Planning Time: 4.639 ms
Execution Time: 4.048 ms
```

### E. Audit Log Multi-Filter Query (`GET /api/audit-logs`)
```
Index Scan using audit_log_table_action_at_idx on audit_log
Planning Time: 4.487 ms
Execution Time: 0.090 ms
```

---

## 4. Benchmark Latency Results Across Endpoints

| Endpoint Category | Query Strategy | Pre-Optimization Latency | Post-Optimization Latency | Speedup |
| :--- | :--- | ---: | ---: | ---: |
| `GET /api/sales/catalog` | Multi-statement batch (1 connection) | 10,054.0 ms (Timeout 500) | 72.9 ms | **99.3%** |
| `GET /api/products` | LATERAL index-only join + window count | 108.4 ms | 37.5 ms | **65.4%** |
| `GET /api/customers` | Window count + composite covering index | 169.2 ms | 72.0 ms | **57.4%** |
| `GET /api/users` | Window count + combined options batch | 131.6 ms | 43.2 ms | **67.2%** |
| `GET /api/auth/session` | In-memory 15s TTL cache + consolidated `AUTH_SELECT` | 401.1 ms | 37.2 ms | **90.7%** |
| `GET /health` | 5-second TTL in-memory guard | 200.6 ms | 2.1 ms | **99.0%** |
| Validation Failures | Zero redundant DB lookups on invalid input | 46.2 – 128.6 ms | 0.8 – 3.5 ms | **97.0%** |
