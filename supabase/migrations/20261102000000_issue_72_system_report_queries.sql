-- Migration: 20261102000000_issue_72_system_report_queries.sql
-- Description: System report queries, views, and table-valued functions for Guide §3.7 (Closes #72)

-- 1. Covering Index for Sales Reports & KPI Lookups
CREATE INDEX IF NOT EXISTS sales_active_reports_idx
  ON public.sales (salesdate DESC, transno)
  INCLUDE (custno, empno)
  WHERE is_deleted = false;

-- 2. Report 1: Top Customers by Sales Amount
-- TVF aggregating active sales lines by customer within date range, ordered by totalsales DESC LIMIT topN
CREATE OR REPLACE FUNCTION public.report_top_customers(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_top_n integer DEFAULT 10
)
RETURNS TABLE (
  rank bigint,
  custno varchar,
  custname varchar,
  totalsales numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) DESC,
               c.custname ASC,
               c.custno ASC
    ) AS rank,
    c.custno,
    c.custname,
    ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) AS totalsales
  FROM public.sales s
  JOIN public.customer c
    ON c.custno = s.custno
   AND c.is_deleted = false
  JOIN public.salesdetail sd
    ON sd.transno = s.transno
   AND sd.is_deleted = false
  LEFT JOIN LATERAL (
    SELECT p.unitprice
    FROM public.pricehist p
    WHERE p.prodcode = sd.prodcode
      AND p.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
      AND p.is_deleted = false
    ORDER BY p.effdate DESC
    LIMIT 1
  ) ph ON true
  WHERE s.is_deleted = false
    AND (p_from_date IS NULL OR s.salesdate >= p_from_date)
    AND (p_to_date IS NULL OR s.salesdate <= p_to_date)
  GROUP BY c.custno, c.custname
  ORDER BY totalsales DESC, c.custname ASC, c.custno ASC
  LIMIT COALESCE(p_top_n, 10);
$function$;

-- 3. Report 2: Product Master List (Current Price)
-- View and TVF returning active products with their current unit price as of today from pricehist
CREATE OR REPLACE VIEW public.report_product_master_list AS
SELECT
  p.prodcode,
  p.description,
  p.unit,
  COALESCE(ph.unitprice, 0.00) AS currentprice
FROM public.product p
LEFT JOIN LATERAL (
  SELECT ph.unitprice
  FROM public.pricehist ph
  WHERE ph.prodcode = p.prodcode
    AND ph.effdate <= CURRENT_DATE
    AND ph.is_deleted = false
  ORDER BY ph.effdate DESC
  LIMIT 1
) ph ON true
WHERE p.is_deleted = false
ORDER BY p.description ASC, p.prodcode ASC;

CREATE OR REPLACE FUNCTION public.report_product_master_list(
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  prodcode varchar,
  description varchar,
  unit varchar,
  currentprice numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    p.prodcode,
    p.description,
    p.unit,
    COALESCE(ph.unitprice, 0.00) AS currentprice
  FROM public.product p
  LEFT JOIN LATERAL (
    SELECT ph.unitprice
    FROM public.pricehist ph
    WHERE ph.prodcode = p.prodcode
      AND ph.effdate <= COALESCE(p_as_of_date, CURRENT_DATE)
      AND ph.is_deleted = false
    ORDER BY ph.effdate DESC
    LIMIT 1
  ) ph ON true
  WHERE p.is_deleted = false
  ORDER BY p.description ASC, p.prodcode ASC;
$function$;

-- 4. Report 3: Top Products by Sales Amount
-- TVF aggregating active sales lines by product within date range, ordered by salesamount DESC LIMIT topN
CREATE OR REPLACE FUNCTION public.report_top_products(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_top_n integer DEFAULT 10
)
RETURNS TABLE (
  rank bigint,
  prodcode varchar,
  description varchar,
  qtysold numeric,
  salesamount numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) DESC,
               p.description ASC,
               p.prodcode ASC
    ) AS rank,
    p.prodcode,
    p.description,
    COALESCE(SUM(sd.quantity), 0)::numeric AS qtysold,
    ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) AS salesamount
  FROM public.sales s
  JOIN public.salesdetail sd
    ON sd.transno = s.transno
   AND sd.is_deleted = false
  JOIN public.product p
    ON p.prodcode = sd.prodcode
   AND p.is_deleted = false
  LEFT JOIN LATERAL (
    SELECT ph.unitprice
    FROM public.pricehist ph
    WHERE ph.prodcode = sd.prodcode
      AND ph.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
      AND ph.is_deleted = false
    ORDER BY ph.effdate DESC
    LIMIT 1
  ) ph ON true
  WHERE s.is_deleted = false
    AND (p_from_date IS NULL OR s.salesdate >= p_from_date)
    AND (p_to_date IS NULL OR s.salesdate <= p_to_date)
  GROUP BY p.prodcode, p.description
  ORDER BY salesamount DESC, p.description ASC, p.prodcode ASC
  LIMIT COALESCE(p_top_n, 10);
$function$;

-- 5. Report 4: Active Employees (Not Separated)
-- View and TVF listing employees currently employed (sepdate IS NULL and is_deleted = false)
CREATE OR REPLACE VIEW public.report_active_employees AS
SELECT
  e.empno,
  e.lastname,
  e.firstname,
  e.gender,
  e.birthdate,
  e.hiredate
FROM public.employee e
WHERE e.is_deleted = false
  AND e.sepdate IS NULL
ORDER BY e.lastname ASC, e.firstname ASC, e.empno ASC;

CREATE OR REPLACE FUNCTION public.report_active_employees()
RETURNS TABLE (
  empno varchar,
  lastname varchar,
  firstname varchar,
  gender character,
  birthdate date,
  hiredate date
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    e.empno,
    e.lastname,
    e.firstname,
    e.gender,
    e.birthdate,
    e.hiredate
  FROM public.employee e
  WHERE e.is_deleted = false
    AND e.sepdate IS NULL
  ORDER BY e.lastname ASC, e.firstname ASC, e.empno ASC;
$function$;

-- 6. Report 5: All Employees (Including Separated)
-- View and TVF listing all employees with employment status (Active / Separated)
CREATE OR REPLACE VIEW public.report_all_employees AS
SELECT
  e.empno,
  e.lastname,
  e.firstname,
  e.gender,
  e.birthdate,
  e.hiredate,
  e.sepdate,
  CASE
    WHEN e.sepdate IS NULL THEN 'Active'
    ELSE 'Separated'
  END AS status
FROM public.employee e
WHERE e.is_deleted = false
ORDER BY e.lastname ASC, e.firstname ASC, e.empno ASC;

CREATE OR REPLACE FUNCTION public.report_all_employees()
RETURNS TABLE (
  empno varchar,
  lastname varchar,
  firstname varchar,
  gender character,
  birthdate date,
  hiredate date,
  sepdate date,
  status text
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    e.empno,
    e.lastname,
    e.firstname,
    e.gender,
    e.birthdate,
    e.hiredate,
    e.sepdate,
    CASE
      WHEN e.sepdate IS NULL THEN 'Active'
      ELSE 'Separated'
    END AS status
  FROM public.employee e
  WHERE e.is_deleted = false
  ORDER BY e.lastname ASC, e.firstname ASC, e.empno ASC;
$function$;

-- 7. Report 6: Employee Job History
-- View and TVF for chronological career progression of employee(s)
CREATE OR REPLACE VIEW public.report_employee_job_history_view AS
SELECT
  jh.empno,
  jh.effdate,
  COALESCE(j.jobdesc, jh.jobcode) AS jobdesc,
  COALESCE(d.deptname, jh.deptcode) AS deptname,
  jh.salary
FROM public.jobhistory jh
LEFT JOIN public.job j
  ON j.jobcode = jh.jobcode
LEFT JOIN public.department d
  ON d.deptcode = jh.deptcode
WHERE jh.is_deleted = false
ORDER BY jh.empno ASC, jh.effdate DESC;

CREATE OR REPLACE FUNCTION public.report_employee_job_history(
  p_empno varchar DEFAULT NULL
)
RETURNS TABLE (
  effdate date,
  jobdesc varchar,
  deptname varchar,
  salary numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    jh.effdate,
    COALESCE(j.jobdesc, jh.jobcode) AS jobdesc,
    COALESCE(d.deptname, jh.deptcode) AS deptname,
    jh.salary
  FROM public.jobhistory jh
  LEFT JOIN public.job j
    ON j.jobcode = jh.jobcode
  LEFT JOIN public.department d
    ON d.deptcode = jh.deptcode
  WHERE jh.is_deleted = false
    AND (p_empno IS NULL OR jh.empno = p_empno)
  ORDER BY jh.effdate DESC;
$function$;

-- 8. Report 7: Top Sales Transactions
-- View and TVF for largest individual sales orders within date range
CREATE OR REPLACE VIEW public.report_top_sales_view AS
WITH line_totals AS (
  SELECT
    s.transno,
    s.salesdate,
    s.custno,
    s.empno,
    ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) AS total
  FROM public.sales s
  JOIN public.salesdetail sd
    ON sd.transno = s.transno
   AND sd.is_deleted = false
  LEFT JOIN LATERAL (
    SELECT p.unitprice
    FROM public.pricehist p
    WHERE p.prodcode = sd.prodcode
      AND p.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
      AND p.is_deleted = false
    ORDER BY p.effdate DESC
    LIMIT 1
  ) ph ON true
  WHERE s.is_deleted = false
  GROUP BY s.transno, s.salesdate, s.custno, s.empno
)
SELECT
  ROW_NUMBER() OVER (ORDER BY lt.total DESC, lt.salesdate DESC, lt.transno DESC) AS rank,
  lt.transno,
  lt.salesdate,
  c.custname,
  TRIM(CONCAT_WS(' ', e.firstname, e.lastname)) AS employeename,
  lt.total
FROM line_totals lt
LEFT JOIN public.customer c
  ON c.custno = lt.custno
LEFT JOIN public.employee e
  ON e.empno = lt.empno
ORDER BY lt.total DESC, lt.salesdate DESC, lt.transno DESC;

CREATE OR REPLACE FUNCTION public.report_top_sales(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_top_n integer DEFAULT 10
)
RETURNS TABLE (
  rank bigint,
  transno varchar,
  salesdate date,
  custname varchar,
  employeename text,
  total numeric
)
LANGUAGE sql
STABLE
AS $function$
  WITH line_totals AS (
    SELECT
      s.transno,
      s.salesdate,
      s.custno,
      s.empno,
      ROUND(SUM(COALESCE(sd.quantity, 0) * COALESCE(ph.unitprice, 0)), 2) AS total
    FROM public.sales s
    JOIN public.salesdetail sd
      ON sd.transno = s.transno
     AND sd.is_deleted = false
    LEFT JOIN LATERAL (
      SELECT p.unitprice
      FROM public.pricehist p
      WHERE p.prodcode = sd.prodcode
        AND p.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
        AND p.is_deleted = false
      ORDER BY p.effdate DESC
      LIMIT 1
    ) ph ON true
    WHERE s.is_deleted = false
      AND (p_from_date IS NULL OR s.salesdate >= p_from_date)
      AND (p_to_date IS NULL OR s.salesdate <= p_to_date)
    GROUP BY s.transno, s.salesdate, s.custno, s.empno
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY lt.total DESC, lt.salesdate DESC, lt.transno DESC) AS rank,
    lt.transno,
    lt.salesdate,
    c.custname,
    TRIM(CONCAT_WS(' ', e.firstname, e.lastname)) AS employeename,
    lt.total
  FROM line_totals lt
  LEFT JOIN public.customer c
    ON c.custno = lt.custno
  LEFT JOIN public.employee e
    ON e.empno = lt.empno
  ORDER BY lt.total DESC, lt.salesdate DESC, lt.transno DESC
  LIMIT COALESCE(p_top_n, 10);
$function$;
