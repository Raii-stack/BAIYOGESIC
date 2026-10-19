-- Sprint 2 CRM and Inventory database support.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE VIEW public.customer_active AS
SELECT *
FROM public.customer
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.product_active AS
SELECT *
FROM public.product
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS customer_custname_trgm_idx
  ON public.customer USING gin (custname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_description_trgm_idx
  ON public.product USING gin (description gin_trgm_ops);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customer'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payterm%'
      AND pg_get_constraintdef(oid) ILIKE '%COD%'
      AND pg_get_constraintdef(oid) ILIKE '%30D%'
      AND pg_get_constraintdef(oid) ILIKE '%45D%'
  ) THEN
    ALTER TABLE public.customer
      ADD CONSTRAINT customer_payterm_check
      CHECK (payterm IN ('COD', '30D', '45D'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%unit%'
      AND pg_get_constraintdef(oid) ILIKE '%pc%'
      AND pg_get_constraintdef(oid) ILIKE '%ea%'
      AND pg_get_constraintdef(oid) ILIKE '%mtr%'
      AND pg_get_constraintdef(oid) ILIKE '%pkg%'
      AND pg_get_constraintdef(oid) ILIKE '%ltr%'
  ) THEN
    ALTER TABLE public.product
      ADD CONSTRAINT product_unit_check
      CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.current_active_price(p_prodcode varchar)
RETURNS TABLE (
  prodcode varchar,
  effdate date,
  unitprice numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT ph.prodcode, ph.effdate, ph.unitprice
  FROM public.pricehist AS ph
  WHERE ph.prodcode = p_prodcode
    AND ph.effdate <= CURRENT_DATE
    AND ph.is_deleted = false
  ORDER BY ph.effdate DESC
  LIMIT 1;
$function$;
