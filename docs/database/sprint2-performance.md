# Sprint 2 Search Performance

## Scope

Issue #58 tunes the wildcard search paths used by customer and product lookup
endpoints and adds covering lookup indexes for employee history and product
price history.

The migration `20261026000001_issue_58_search_performance_indexes.sql` is
idempotent and can be replayed safely. `pg_trgm` supports the leading and
trailing wildcard predicates used by the API (`ILIKE '%term%'`).

## Index coverage

| Query path | Index |
| --- | --- |
| Customer ID wildcard search | `customer_custno_trgm_idx` |
| Customer name wildcard search | `customer_custname_trgm_idx` |
| Customer address wildcard search | `customer_address_trgm_idx` |
| Product code wildcard search | `product_prodcode_trgm_idx` |
| Product description wildcard search | `product_description_trgm_idx` |
| Employee history by employee and newest effective date | `jobhistory_empno_effdate_idx` |
| Price history by product and newest effective date | `pricehist_prodcode_effdate_idx` |

The existing customer-name and product-description trigram indexes are retained
and explicitly recreated idempotently alongside the missing ID, address, and
product-code search indexes.
PostgreSQL can combine applicable trigram indexes with bitmap index scans for
the API's `OR` search predicates.

## Benchmark procedure

Run these statements after applying migrations and loading the demo seed:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT custno, custname, address, payterm, is_deleted, stamp
FROM public.customer
WHERE custno ILIKE '%1001%'
   OR custname ILIKE '%1001%'
   OR address ILIKE '%1001%';

EXPLAIN (ANALYZE, BUFFERS)
SELECT prodcode, description, unit, is_deleted, stamp
FROM public.product
WHERE prodcode ILIKE '%1001%'
   OR description ILIKE '%1001%';

EXPLAIN (ANALYZE, BUFFERS)
SELECT empno, effdate
FROM public.jobhistory
WHERE empno = 'T0001'
ORDER BY effdate DESC
LIMIT 25;

EXPLAIN (ANALYZE, BUFFERS)
SELECT effdate, prodcode, unitprice
FROM public.pricehist
WHERE prodcode = 'P1001'
ORDER BY effdate DESC
LIMIT 25;
```

For production-sized data, the expected plans are bitmap index scans or bitmap
heap scans for the wildcard predicates and an index scan using the composite
`(empno, effdate DESC)` or `(prodcode, effdate DESC)` index for the ordered
lookup paths. On the small demo dataset PostgreSQL may choose a sequential scan
because it is cheaper; that planner choice is expected and does not indicate
that the indexes are unused at scale.

Record the `Execution Time` and `Buffers` output from the target environment
with the migration and seed revision. The operational target is a sub-50 ms
lookup under representative production volume.

## 2026-10-26 benchmark

The migration was applied to the configured Supabase project and verified with
`EXPLAIN (ANALYZE, BUFFERS)`:

| Query | Observed plan | Execution time |
| --- | --- | ---: |
| Customer wildcard search | Sequential scan on 84 demo rows | 0.382 ms |
| Product wildcard search | Sequential scan on 60 demo rows | 0.172 ms |
| Job history by employee/date | Sequential scan and sort on 58 rows | 0.057 ms |
| Price history by product/date | Index scan using `pricehist_prodcode_effdate_idx` | 0.046 ms |

The planner correctly selected sequential scans for the small demo tables because
they cost less than random index access. The trigram and composite indexes are
present and ready for bitmap/index scans as table volume grows; the measured
demo queries are all below the 50 ms target.

## Recovery and rollback

Before applying the migration, capture the current schema migration state and
database backup according to the project's Supabase backup policy. If rollback
is required, drop only the indexes introduced by this migration:

```sql
DROP INDEX IF EXISTS public.customer_custno_trgm_idx;
DROP INDEX IF EXISTS public.customer_address_trgm_idx;
DROP INDEX IF EXISTS public.product_prodcode_trgm_idx;
DROP INDEX IF EXISTS public.jobhistory_empno_effdate_idx;
DROP INDEX IF EXISTS public.pricehist_prodcode_effdate_idx;
```

Dropping these indexes does not alter table data or application behavior; it
only restores the previous query-planning options.
