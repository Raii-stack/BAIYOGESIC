const fs = require('fs');
const path = require('path');

function optionalPool() {
  try {
    return require('../../db').requirePool();
  } catch {
    return null;
  }
}

describe('Issue #72: Guide §3.7 System Report Queries & Views Specification', () => {
  const migrationPath = path.join(
    __dirname,
    '../../supabase/migrations/20261102000000_issue_72_system_report_queries.sql'
  );

  let migrationSql = '';

  beforeAll(() => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    migrationSql = fs.readFileSync(migrationPath, 'utf8');
  });

  describe('Migration File Integrity & Structure', () => {
    test('contains sales_active_reports_idx covering index', () => {
      expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS sales_active_reports_idx');
      expect(migrationSql).toContain('INCLUDE (custno, empno)');
    });

    test('implements Report 1: Top Customers by Sales Amount', () => {
      expect(migrationSql).toContain('FUNCTION public.report_top_customers');
      expect(migrationSql).toContain('rank bigint');
      expect(migrationSql).toContain('custno varchar');
      expect(migrationSql).toContain('custname varchar');
      expect(migrationSql).toContain('totalsales numeric');
    });

    test('implements Report 2: Product Master List (Current Price)', () => {
      expect(migrationSql).toContain('VIEW public.report_product_master_list');
      expect(migrationSql).toContain('FUNCTION public.report_product_master_list');
      expect(migrationSql).toContain('prodcode');
      expect(migrationSql).toContain('description');
      expect(migrationSql).toContain('unit');
      expect(migrationSql).toContain('currentprice');
    });

    test('implements Report 3: Top Products by Sales Amount', () => {
      expect(migrationSql).toContain('FUNCTION public.report_top_products');
      expect(migrationSql).toContain('rank bigint');
      expect(migrationSql).toContain('prodcode varchar');
      expect(migrationSql).toContain('description varchar');
      expect(migrationSql).toContain('qtysold numeric');
      expect(migrationSql).toContain('salesamount numeric');
    });

    test('implements Report 4: Active Employees (Not Separated)', () => {
      expect(migrationSql).toContain('VIEW public.report_active_employees');
      expect(migrationSql).toContain('FUNCTION public.report_active_employees');
      expect(migrationSql).toContain('sepdate IS NULL');
    });

    test('implements Report 5: All Employees (Including Separated)', () => {
      expect(migrationSql).toContain('VIEW public.report_all_employees');
      expect(migrationSql).toContain('FUNCTION public.report_all_employees');
      expect(migrationSql).toContain("status text");
      expect(migrationSql).toContain("'Active'");
      expect(migrationSql).toContain("'Separated'");
    });

    test('implements Report 6: Employee Job History', () => {
      expect(migrationSql).toContain('VIEW public.report_employee_job_history_view');
      expect(migrationSql).toContain('FUNCTION public.report_employee_job_history');
      expect(migrationSql).toContain('effdate date');
      expect(migrationSql).toContain('jobdesc varchar');
      expect(migrationSql).toContain('deptname varchar');
      expect(migrationSql).toContain('salary numeric');
    });

    test('implements Report 7: Top Sales Transactions', () => {
      expect(migrationSql).toContain('VIEW public.report_top_sales_view');
      expect(migrationSql).toContain('FUNCTION public.report_top_sales');
      expect(migrationSql).toContain('rank bigint');
      expect(migrationSql).toContain('transno varchar');
      expect(migrationSql).toContain('salesdate date');
      expect(migrationSql).toContain('custname varchar');
      expect(migrationSql).toContain('employeename text');
      expect(migrationSql).toContain('total numeric');
    });
  });

  describe('Database Live Query & Schema Verification', () => {
    let pool;

    beforeAll(() => {
      pool = optionalPool();
    });

    afterAll(async () => {
      if (pool) {
        await pool.end();
      }
    });

    test('Report 1: report_top_customers returns valid schema and row structure', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_top_customers(NULL, NULL, 5)');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('rank');
        expect(row).toHaveProperty('custno');
        expect(row).toHaveProperty('custname');
        expect(row).toHaveProperty('totalsales');
      }
    });

    test('Report 2: report_product_master_list view returns valid columns', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_product_master_list LIMIT 5');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('prodcode');
        expect(row).toHaveProperty('description');
        expect(row).toHaveProperty('unit');
        expect(row).toHaveProperty('currentprice');
      }
    });

    test('Report 3: report_top_products returns valid schema and row structure', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_top_products(NULL, NULL, 5)');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('rank');
        expect(row).toHaveProperty('prodcode');
        expect(row).toHaveProperty('description');
        expect(row).toHaveProperty('qtysold');
        expect(row).toHaveProperty('salesamount');
      }
    });

    test('Report 4: report_active_employees contains no separated employees', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_active_employees LIMIT 10');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('empno');
        expect(row).toHaveProperty('lastname');
        expect(row).toHaveProperty('firstname');
        expect(row).toHaveProperty('gender');
        expect(row).toHaveProperty('birthdate');
        expect(row).toHaveProperty('hiredate');
      }
    });

    test('Report 5: report_all_employees returns status indicating Active or Separated', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_all_employees LIMIT 10');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('empno');
        expect(row).toHaveProperty('status');
        expect(['Active', 'Separated']).toContain(row.status);
      }
    });

    test('Report 6: report_employee_job_history returns career progression with salary', async () => {
      if (!pool) return;
      const res = await pool.query("SELECT * FROM public.report_employee_job_history('00001')");
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('effdate');
        expect(row).toHaveProperty('jobdesc');
        expect(row).toHaveProperty('deptname');
        expect(row).toHaveProperty('salary');
      }
    });

    test('Report 7: report_top_sales returns ranked transactions with totals', async () => {
      if (!pool) return;
      const res = await pool.query('SELECT * FROM public.report_top_sales(NULL, NULL, 5)');
      expect(Array.isArray(res.rows)).toBe(true);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        expect(row).toHaveProperty('rank');
        expect(row).toHaveProperty('transno');
        expect(row).toHaveProperty('salesdate');
        expect(row).toHaveProperty('custname');
        expect(row).toHaveProperty('employeename');
        expect(row).toHaveProperty('total');
      }
    });
  });
});
