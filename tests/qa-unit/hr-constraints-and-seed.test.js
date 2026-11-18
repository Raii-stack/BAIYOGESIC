const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #65: HR Child-Record Delete Constraints & Personnel Demo Data', () => {
  const hrSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261027000000_issue_65_hr_constraints_and_demo_data.sql'),
    'utf8'
  );

  test('defines active HR views filtering out soft-deleted records', () => {
    for (const view of ['department_active', 'job_active', 'employee_active', 'jobhistory_active']) {
      expect(hrSql).toContain(`CREATE OR REPLACE VIEW public.${view}`);
    }
  });

  test('enforces HR check constraints, foreign keys, and soft/hard delete triggers', () => {
    expect(hrSql).toContain("CHECK (gender = ANY (ARRAY['M'::bpchar, 'F'::bpchar]))");
    expect(hrSql).toContain('CHECK (salary >= 0.0)');
    expect(hrSql).toContain('jobhistory_empno_fkey');
    expect(hrSql).toContain('jobhistory_jobcode_fkey');
    expect(hrSql).toContain('jobhistory_deptcode_fkey');
    expect(hrSql).toContain('sales_empno_fkey');

    for (const table of ['department', 'job', 'employee', 'jobhistory']) {
      expect(hrSql).toContain(`tgname = '${table}_bd_block'`);
      expect(hrSql).toContain(`tgname = '${table}_bu_check'`);
    }
  });

  test('seeds HR departments, jobs, personnel, and jobhistory idempotently', () => {
    expect(hrSql).toContain('INSERT INTO public.department (deptcode, deptname, is_deleted)');
    expect(hrSql).toContain('ON CONFLICT (deptcode) DO UPDATE');
    expect(hrSql).toContain('INSERT INTO public.job (jobcode, jobdesc, is_deleted)');
    expect(hrSql).toContain('ON CONFLICT (jobcode) DO UPDATE');
    expect(hrSql).toContain('INSERT INTO public.employee (empno, lastname, firstname, gender, birthdate, hiredate, sepdate, email, is_deleted)');
    expect(hrSql).toContain('ON CONFLICT (empno) DO UPDATE');
    expect(hrSql).toContain('INSERT INTO public.jobhistory (empno, jobcode, effdate, salary, deptcode, is_deleted)');
    expect(hrSql).toContain('ON CONFLICT (empno, jobcode, effdate) DO UPDATE');
  });
});
