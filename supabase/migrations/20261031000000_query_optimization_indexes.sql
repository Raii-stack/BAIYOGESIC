-- Migration: 20261031000000_query_optimization_indexes.sql
-- Description: Query optimization, covering indexes & fast API response tuning (Closes #169)

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
