const { peopleScope, assertPerson } = require('../lib/people-access');
const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

function requestError(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  if (details) error.details = details;
  return error;
}

function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() + 1 === Number(match[2])
    && parsed.getUTCDate() === Number(match[3]);
}

function reportFilters(query = {}) {
  const startDate = String(query.startDate || '').trim() || null;
  const endDate = String(query.endDate || '').trim() || null;
  if (startDate && !isIsoDate(startDate)) {
    throw requestError('From date must be a valid date.', { startDate: 'Use YYYY-MM-DD.' });
  }
  if (endDate && !isIsoDate(endDate)) {
    throw requestError('To date must be a valid date.', { endDate: 'Use YYYY-MM-DD.' });
  }
  if (startDate && endDate && startDate > endDate) {
    throw requestError('From date cannot be after To date.', { startDate: 'Choose a date on or before To.' });
  }
  const rawLimit = query.limit === undefined || query.limit === '' ? 10 : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    throw requestError('Limit must be an integer from 1 to 100.', { limit: 'Choose 1 to 100.' });
  }
  return { startDate, endDate, limit: rawLimit };
}

function sendReport(res, report, rows, extra = {}) {
  res.json({ success: true, data: { report, rows, ...extra } });
}

const topCustomers = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit } = reportFilters(req.query);
  const result = await requirePool().query(
    'SELECT * FROM public.report_top_customers($1::date, $2::date, $3::integer)',
    [startDate, endDate, limit]
  );
  sendReport(res, 'top-customers', result.rows);
});

const productMaster = asyncHandler(async (_req, res) => {
  const result = await requirePool().query('SELECT * FROM public.report_product_master_list');
  sendReport(res, 'product-master', result.rows);
});

const topProducts = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit } = reportFilters(req.query);
  const result = await requirePool().query(
    'SELECT * FROM public.report_top_products($1::date, $2::date, $3::integer)',
    [startDate, endDate, limit]
  );
  sendReport(res, 'top-products', result.rows);
});

const activeEmployees = asyncHandler(async (req, res) => {
  const result = await requirePool().query(`SELECT * FROM public.report_active_employees r WHERE ${peopleScope(req.user, 'r.empno')}`);
  sendReport(res, 'active-employees', result.rows);
});

const allEmployees = asyncHandler(async (req, res) => {
  const result = await requirePool().query(`SELECT * FROM public.report_all_employees r WHERE ${peopleScope(req.user, 'r.empno')}`);
  sendReport(res, 'all-employees', result.rows);
});

const jobHistory = asyncHandler(async (req, res) => {
  const empno = String(req.query.empno || '').trim();
  const pool = requirePool();
  if (empno) await assertPerson(pool, req.user, empno);
  const [rows, employees] = await Promise.all([
    empno
      ? pool.query('SELECT * FROM public.report_employee_job_history($1::varchar)', [empno])
      : Promise.resolve({ rows: [] }),
    pool.query(
      `SELECT empno, TRIM(CONCAT_WS(' ', firstname, lastname)) AS fullname
       FROM public.employee e
       WHERE is_deleted = false AND sepdate IS NULL AND ${peopleScope(req.user, 'e.empno')}
       ORDER BY lastname, firstname, empno`
    )
  ]);
  if (empno && !employees.rows.some((employee) => employee.empno === empno)) {
    throw requestError('Select a valid active employee.', { empno: 'Employee was not found.' });
  }
  sendReport(res, 'job-history', rows.rows, { employees: employees.rows });
});

const topSales = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit } = reportFilters(req.query);
  const result = await requirePool().query(
    `SELECT row_number() OVER (ORDER BY r.total DESC, r.salesdate DESC, r.transno DESC) AS rank,
      r.transno, r.salesdate, r.custname, r.employeename, r.total
     FROM public.report_top_sales_view r JOIN public.sales s ON s.transno = r.transno
     WHERE ($1::date IS NULL OR r.salesdate >= $1) AND ($2::date IS NULL OR r.salesdate <= $2)
       AND ${peopleScope(req.user, 's.empno')}
     ORDER BY r.total DESC, r.salesdate DESC, r.transno DESC LIMIT $3`,
    [startDate, endDate, limit]
  );
  sendReport(res, 'top-sales', result.rows);
});

module.exports = { topCustomers, productMaster, topProducts, activeEmployees, allEmployees, jobHistory, topSales, reportFilters };
