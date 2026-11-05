-- Issue #58: wildcard search and effective-date lookup indexes.
-- These indexes are intentionally idempotent so the migration can be replayed.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS customer_custname_trgm_idx
  ON public.customer USING gin (custname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customer_custno_trgm_idx
  ON public.customer USING gin (custno gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customer_address_trgm_idx
  ON public.customer USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_description_trgm_idx
  ON public.product USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_prodcode_trgm_idx
  ON public.product USING gin (prodcode gin_trgm_ops);

CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_idx
  ON public.jobhistory (empno, effdate DESC);

CREATE INDEX IF NOT EXISTS pricehist_prodcode_effdate_idx
  ON public.pricehist (prodcode, effdate DESC);
