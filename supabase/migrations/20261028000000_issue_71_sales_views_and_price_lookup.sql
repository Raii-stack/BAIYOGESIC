-- Issue #71 [S4-DEV-01 & S4-DEV-02]: Sales Transaction Header, Line Items, Price-as-of-Date Lookup & Balance View

-- 1. Active Sales Views
CREATE OR REPLACE VIEW public.sales_active AS
SELECT *
FROM public.sales
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.salesdetail_active AS
SELECT *
FROM public.salesdetail
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.payment_active AS
SELECT *
FROM public.payment
WHERE is_deleted = false;

-- 2. Unit Price Lookup as of Sales Date Function
CREATE OR REPLACE FUNCTION public.price_as_of_date(p_prodcode varchar, p_salesdate date DEFAULT CURRENT_DATE)
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
    AND ph.effdate <= COALESCE(p_salesdate, CURRENT_DATE)
    AND ph.is_deleted = false
  ORDER BY ph.effdate DESC
  LIMIT 1;
$function$;

-- 3. Sales Balance View (Line Subtotals, Tax, Total Amount, Payments, Remaining Balance, and Status Badge)
CREATE OR REPLACE VIEW public.sales_balance_view AS
WITH line_totals AS (
  SELECT
    s.transno,
    COALESCE(
      ROUND(
        SUM(
          CASE
            WHEN sd.is_deleted = s.is_deleted THEN COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)
            ELSE 0
          END
        ),
        2
      ),
      0.00
    ) AS subtotal
  FROM public.sales s
  LEFT JOIN public.salesdetail sd
    ON sd.transno = s.transno
  LEFT JOIN LATERAL (
    SELECT p.unitprice
    FROM public.pricehist p
    WHERE p.prodcode = sd.prodcode
      AND p.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
      AND p.is_deleted = false
    ORDER BY p.effdate DESC
    LIMIT 1
  ) ph ON true
  GROUP BY s.transno
),
payment_totals AS (
  SELECT
    p.transno,
    COALESCE(ROUND(SUM(p.amount), 2), 0.00) AS amount_paid
  FROM public.payment p
  WHERE p.is_deleted = false
  GROUP BY p.transno
)
SELECT
  s.transno,
  s.salesdate,
  s.custno,
  s.empno,
  s.is_deleted,
  s.stamp,
  COALESCE(lt.subtotal, 0.00) AS subtotal,
  0.00::numeric(12, 2) AS tax,
  COALESCE(lt.subtotal, 0.00) AS total_amount,
  COALESCE(pt.amount_paid, 0.00) AS amount_paid,
  GREATEST(0.00, ROUND(COALESCE(lt.subtotal, 0.00) - COALESCE(pt.amount_paid, 0.00), 2)) AS balance,
  CASE
    WHEN COALESCE(lt.subtotal, 0.00) > 0 AND ROUND(COALESCE(lt.subtotal, 0.00) - COALESCE(pt.amount_paid, 0.00), 2) <= 0 THEN 'Paid'
    WHEN COALESCE(pt.amount_paid, 0.00) > 0 THEN 'Partial'
    ELSE 'Unpaid'
  END AS payment_status
FROM public.sales s
LEFT JOIN line_totals lt ON lt.transno = s.transno
LEFT JOIN payment_totals pt ON pt.transno = s.transno;

-- 4. Covering Indexes for Sales Lookups and Aggregations
CREATE INDEX IF NOT EXISTS sales_salesdate_transno_idx
  ON public.sales (salesdate DESC, transno DESC);

CREATE INDEX IF NOT EXISTS sales_custno_idx
  ON public.sales (custno)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS sales_empno_idx
  ON public.sales (empno)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS salesdetail_transno_idx
  ON public.salesdetail (transno);

CREATE INDEX IF NOT EXISTS payment_transno_idx
  ON public.payment (transno)
  WHERE is_deleted = false;
