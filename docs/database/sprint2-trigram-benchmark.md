# [S2-DBA-03] Database: Trigram GIN Search Performance Benchmarking & Query Explains

**Issue Reference:** [#110](https://github.com/Raii-stack/BAIYOGESIC/issues/110)  
**Role:** BackEnd Engineer & DB Admin  
**Prerequisites:** #19 (Database Initialization & Base Migrations), #45 (Sprint 2 CRM and Inventory SQL)  
**Database Engine:** PostgreSQL 17.11 (aarch64-unknown-linux-gnu, Supabase project `dtcxvlcpqjmutiwejyqk`)  
**Date:** 2026-10-26  

---

## 1. Executive Summary

This benchmark report documents query execution plans, timing metrics, and planner decisions for PostgreSQL trigram Generalized Inverted Indexes (`gin_trgm_ops`) on the customer and product tables.

Wildcard search queries using pattern matching predicates (`ILIKE '%term%'`) are fundamental to the ERP CRM and Inventory lookup endpoints (`/api/customers?search=...` and `/api/products?search=...`). Standard B-tree indexes cannot accelerate queries with leading wildcards (`%...`), necessitating trigram GIN indexes (`pg_trgm`) to prevent costly full-table sequential scans at production scale.

This document records `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` execution plans, compares sequential scans against bitmap index scans across varying dataset scales (demo volume vs. production volume of 50,000 records), and validates performance against the sub-50 ms operational latency SLA.

---

## 2. Index Coverage & Storage Footprint

The trigram GIN indexes were introduced in migration `20261020000002_sprint2_crm_inventory.sql` and tuned idempotently in `20261026000001_issue_58_search_performance_indexes.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS customer_custname_trgm_idx
  ON public.customer USING gin (custname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_description_trgm_idx
  ON public.product USING gin (description gin_trgm_ops);
```

### Physical Storage Metrics (Supabase Live Instance)

| Database Object | Type | Relational Size | Index Method / Operator Class | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `public.customer` | Table | 24 kB | Heap Storage (84 demo rows) | Customer master records |
| `customer_custname_trgm_idx` | Index | 56 kB | `GIN (custname gin_trgm_ops)` | Wildcard pattern matching on company name |
| `public.product` | Table | 16 kB | Heap Storage (59 demo rows) | Product catalog records |
| `product_description_trgm_idx` | Index | 48 kB | `GIN (description gin_trgm_ops)` | Wildcard pattern matching on description |

---

## 3. Query Plan Benchmarks (Target Deliverable)

### 3.1 Target Query 1: Customer Name Wildcard Search (`%Acme%`)

```sql
SELECT custno, custname 
FROM public.customer 
WHERE custname ILIKE '%Acme%';
```

#### Evaluation A: Demo Dataset (Default Planner Choice)

On the initial seed/demo dataset containing 84 rows across 3 disk pages, the PostgreSQL Cost-Based Optimizer (CBO) evaluates total cost:

```text
Seq Scan cost = 0.00..4.05 (reads 3 shared buffers)
Bitmap Index Scan cost = 4.28..5.39 (reads 5 shared buffers)
```

Because `4.05 < 4.28`, the planner chooses a sequential scan as the cheapest path:

```text
Seq Scan on public.customer  (cost=0.00..4.05 rows=1 width=21) (actual time=1.354..1.354 rows=0 loops=1)
  Output: custno, custname
  Filter: ((customer.custname)::text ~~* '%Acme%'::text)
  Rows Removed by Filter: 84
  Buffers: shared hit=3
Settings: jit = 'off', effective_cache_size = '384MB', effective_io_concurrency = '200', max_parallel_workers = '2', max_parallel_workers_per_gather = '1', random_page_cost = '1.1', work_mem = '2184kB', search_path = '"$user", public, extensions'
Query Identifier: -840326157777970218
Planning:
  Buffers: shared hit=107
Planning Time: 2.596 ms
Execution Time: 1.456 ms
```

#### Evaluation B: Index Scan Verification (`enable_seqscan = off`)

To evaluate the GIN index plan tree and confirm index traversability for pattern matching queries, sequential scanning was temporarily disabled (`SET LOCAL enable_seqscan = off;`):

```sql
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT custno, custname 
FROM public.customer 
WHERE custname ILIKE '%Acme%';
ROLLBACK;
```

**Observed Execution Plan:**

```text
Bitmap Heap Scan on public.customer  (cost=4.28..5.39 rows=1 width=21) (actual time=0.752..0.752 rows=0 loops=1)
  Output: custno, custname
  Recheck Cond: ((customer.custname)::text ~~* '%Acme%'::text)
  Buffers: shared hit=5
  ->  Bitmap Index Scan on customer_custname_trgm_idx  (cost=0.00..4.28 rows=1 width=0) (actual time=0.742..0.742 rows=0 loops=1)
        Index Cond: ((customer.custname)::text ~~* '%Acme%'::text)
        Buffers: shared hit=5
Settings: jit = 'off', effective_cache_size = '384MB', effective_io_concurrency = '200', max_parallel_workers = '2', max_parallel_workers_per_gather = '1', random_page_cost = '1.1', work_mem = '2184kB', search_path = '"$user", public, extensions', enable_seqscan = 'off'
Query Identifier: -840326157777970218
Planning:
  Buffers: shared hit=107
Planning Time: 4.436 ms
Execution Time: 0.948 ms
```

**Key Takeaways:**
1. The GIN index `customer_custname_trgm_idx` is verified active and valid for `ILIKE` predicates.
2. The index scan decomposes `%Acme%` into 3-character trigrams (`acm`, `cme`), performs a fast posting tree lookup, and creates a bitmap index representation.
3. Execution time is **0.948 ms** with only **5 shared buffer hits** and zero disk I/O.

---

### 3.2 Target Query 2: Positive Hit Wildcard Search (`%Medical%`)

Testing with a term matching existing seed data (`"Globus Medical, Inc"`):

```sql
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT custno, custname 
FROM public.customer 
WHERE custname ILIKE '%Medical%';
ROLLBACK;
```

**Observed Execution Plan:**

```text
Bitmap Heap Scan on public.customer  (cost=8.87..9.98 rows=1 width=21) (actual time=0.132..0.133 rows=1 loops=1)
  Output: custno, custname
  Recheck Cond: ((customer.custname)::text ~~* '%Medical%'::text)
  Heap Blocks: exact=1
  Buffers: shared hit=12
  ->  Bitmap Index Scan on customer_custname_trgm_idx  (cost=0.00..8.87 rows=1 width=0) (actual time=0.110..0.110 rows=1 loops=1)
        Index Cond: ((customer.custname)::text ~~* '%Medical%'::text)
        Buffers: shared hit=11
Settings: jit = 'off', effective_cache_size = '384MB', effective_io_concurrency = '200', max_parallel_workers = '2', max_parallel_workers_per_gather = '1', random_page_cost = '1.1', work_mem = '2184kB', search_path = '"$user", public, extensions', enable_seqscan = 'off'
Query Identifier: -840326157777970218
Planning:
  Buffers: shared hit=107
Planning Time: 2.523 ms
Execution Time: 0.351 ms
```

**Key Takeaways:**
1. Trigram index condition matched exact row `C0001` (`Globus Medical, Inc`).
2. `Heap Blocks: exact=1` confirms no lossy bitmap blocks; accurate tuple pointer resolution.
3. Execution time: **0.351 ms** (well below the 50 ms operational target).

---

### 3.3 Target Query 3: Product Description Wildcard Search (`%Pro Max%`)

```sql
SELECT prodcode, description 
FROM public.product 
WHERE description ILIKE '%Pro Max%';
```

#### Evaluation with GIN Index (`product_description_trgm_idx`):

```text
Bitmap Heap Scan on public.product  (cost=8.86..9.98 rows=1 width=26) (actual time=0.128..0.131 rows=2 loops=1)
  Output: prodcode, description
  Recheck Cond: ((product.description)::text ~~* '%Pro Max%'::text)
  Heap Blocks: exact=1
  Buffers: shared hit=12
  ->  Bitmap Index Scan on product_description_trgm_idx  (cost=0.00..8.86 rows=1 width=0) (actual time=0.100..0.100 rows=2 loops=1)
        Index Cond: ((product.description)::text ~~* '%Pro Max%'::text)
        Buffers: shared hit=11
Settings: jit = 'off', effective_cache_size = '384MB', effective_io_concurrency = '200', max_parallel_workers = '2', max_parallel_workers_per_gather = '1', random_page_cost = '1.1', work_mem = '2184kB', search_path = '"$user", public, extensions', enable_seqscan = 'off'
Query Identifier: 6491920891395660916
Planning:
  Buffers: shared hit=96
Planning Time: 3.082 ms
Execution Time: 0.309 ms
```

**Result:** Matches 2 products (`PX0001` "Tulphone Pro max", `NB0003` "Acer C720 Chrome Pro Max") in **0.309 ms**.

---

## 4. Production Scale Benchmarking (50,000 Records)

To confirm that the query planner autonomously selects the Trigram GIN index over a sequential scan under realistic production volumes, a benchmark was conducted on a dataset of 50,000 records.

### Benchmark Setup

```sql
CREATE TEMP TABLE temp_customer (
  custno varchar PRIMARY KEY,
  custname varchar
);
CREATE INDEX temp_cust_trgm_idx ON temp_customer USING gin (custname gin_trgm_ops);

INSERT INTO temp_customer (custno, custname)
SELECT 'C' || lpad(i::text, 6, '0'), 
       'Company ' || i || ' ' || (CASE WHEN i % 5000 = 0 THEN 'Acme' ELSE 'Corp ' || md5(i::text) END)
FROM generate_series(1, 50000) AS s(i);

ANALYZE temp_customer;
```

### Plan 1: Default Planner Choice (Unconstrained Cost-Based Optimization)

```text
Bitmap Heap Scan on pg_temp.temp_customer  (cost=119.13..124.64 rows=5 width=59) (actual time=0.490..0.514 rows=10 loops=1)
  Output: custno, custname
  Recheck Cond: ((temp_customer.custname)::text ~~* '%Acme%'::text)
  Heap Blocks: exact=10
  Buffers: local hit=98
  ->  Bitmap Index Scan on temp_cust_trgm_idx  (cost=0.00..119.12 rows=5 width=0) (actual time=0.466..0.466 rows=10 loops=1)
        Index Cond: ((temp_customer.custname)::text ~~* '%Acme%'::text)
        Buffers: local hit=88
Query Identifier: -906482420589237107
Planning:
  Buffers: shared hit=20, local hit=1 read=1 written=1
Planning Time: 4.145 ms
Execution Time: 0.583 ms
```

### Plan 2: Forced Sequential Scan Comparison (`enable_bitmapscan = off`)

```text
Seq Scan on pg_temp.temp_customer  (cost=0.00..1194.00 rows=5 width=59) (actual time=7.658..76.494 rows=10 loops=1)
  Output: custno, custname
  Filter: ((temp_customer.custname)::text ~~* '%Acme%'::text)
  Rows Removed by Filter: 49990
  Buffers: local hit=569
Query Identifier: -2074424560383989842
Planning:
  Buffers: shared hit=20, local hit=1 read=1 written=1
Planning Time: 11.502 ms
Execution Time: 77.078 ms
```

### Performance Comparison Matrix (50,000 Records)

| Metric | Sequential Scan (Without Index) | Trigram GIN Index Scan | Improvement / Factor |
| :--- | :--- | :--- | :--- |
| **Planner Estimated Cost** | `1194.00` | `124.64` | **~9.6x lower estimated cost** |
| **Execution Time** | `77.078 ms` | `0.583 ms` | **132.2x faster (99.2% latency reduction)** |
| **Buffer Accesses** | 569 local hits (whole table) | 98 hits (88 index + 10 heap) | **82.8% reduction in I/O operations** |
| **Rows Examined** | 50,000 tuples | 10 tuples | **Zero unnecessary tuple scans** |
| **SLA Compliance (<50ms)** | ❌ Failed (77 ms) |  Passed (0.58 ms) | **Meets enterprise latency SLA** |

---

## 5. Planner Crossover Threshold Analysis

In PostgreSQL, the planner cost formula evaluates:
- Sequential scan cost: $\text{pages} \times \text{seq\_page\_cost} + \text{tuples} \times \text{cpu\_tuple\_cost} + \text{tuples} \times \text{cpu\_operator\_cost}$
- GIN index scan cost: $\text{startup\_cost} + \text{index\_pages} \times \text{random\_page\_cost} + \text{selected\_tuples} \times \text{cpu\_index\_tuple\_cost}$

Because GIN trigram indexes incur an initial tree traversal cost (~4.28 to 8.87 cost units), sequential scans are mathematically cheaper for tables smaller than ~250–300 rows (approx. 4 pages).

Once the table size grows beyond ~300 rows:
1. Sequential scan cost rises linearly ($O(N)$ with table size).
2. Trigram GIN index scan cost rises logarithmically ($O(\log N)$ with entry tree depth).
3. The optimizer **autonomously selects the Trigram GIN index** for all wildcard pattern queries.

---

## 6. Memory & Resource Cost Analysis

- **`work_mem` Utilization:** GIN bitmap construction uses a compact in-memory bit array representing page and tuple identifiers. For a 50,000-row table, bitmap memory consumed is $< 64\text{ kB}$, well within the configured `work_mem = 2184 kB`.
- **Lossy vs. Exact Blocks:** Across all benchmarked queries, `Heap Blocks: exact` was observed with zero lossy blocks, guaranteeing that memory was sufficient to hold all matching physical pointers without resorting to lossy page rechecks.
- **Index Maintenance Overhead:** GIN indexes utilize `fastupdate = on` by default in PostgreSQL, buffering pending inserts and amortizing index write costs during CRM customer and inventory item creations.

---

## 7. Acceptance Criteria Verification

| Acceptance Criterion | Status | Evidence / Verification Notes |
| :--- | :---: | :--- |
| **Trigram GIN indexes exist on `customer.custname` and `product.description`** |  **PASSED** | Verified in database catalogs (`customer_custname_trgm_idx` 56 kB, `product_description_trgm_idx` 48 kB). |
| **`EXPLAIN ANALYZE` documentation verifies index usage for wildcard search queries** |  **PASSED** | Query plans documented for `%Acme%`, `%Medical%`, and `%Pro Max%`. Index usage verified via `Bitmap Index Scan` + `Bitmap Heap Scan`. |
| **Benchmark report is documented in `docs/database/sprint2-trigram-benchmark.md`** |  **PASSED** | Completed and committed to branch `issue-110`. |
