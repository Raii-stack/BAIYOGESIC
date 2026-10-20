const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

const canViewSalary = (user) => ['superadmin', 'administrator', 'admin'].includes(user.role);

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function employeeSelect(salaryAllowed) {
  return `e.empno, e.firstname, e.lastname, e.email, e.gender,
    e.birthdate::text AS birthdate, e.hiredate::text AS hiredate,
    e.sepdate::text AS sepdate, e.is_deleted, e.stamp,
    h.jobcode, h.deptcode, h.effdate::text AS effdate,
    j.jobdesc, d.deptname,
    ${salaryAllowed ? 'h.salary' : 'NULL::numeric'} AS salary`;
}

const latestJob = `LEFT JOIN LATERAL (
  SELECT jobcode, deptcode, effdate, salary
  FROM public.jobhistory
  WHERE empno = e.empno AND is_deleted = e.is_deleted
  ORDER BY effdate DESC, jobcode DESC
  LIMIT 1
) h ON true
LEFT JOIN public.job j ON j.jobcode = h.jobcode
LEFT JOIN public.department d ON d.deptcode = h.deptcode`;

const listEmployees = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 100000);
  const limit = positiveInteger(req.query.limit, 10, 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const department = typeof req.query.department === 'string' ? req.query.department.trim() : '';
  const job = typeof req.query.job === 'string' ? req.query.job.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
  if (!['all', 'active', 'separated', 'archived'].includes(status)) throw requestError('Invalid employee status', 400);
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(e.empno ILIKE $${values.length} OR e.firstname ILIKE $${values.length} OR e.lastname ILIKE $${values.length} OR concat_ws(' ', e.firstname, e.lastname) ILIKE $${values.length} OR e.email ILIKE $${values.length})`);
  }
  if (department) { values.push(department); filters.push(`h.deptcode = $${values.length}`); }
  if (job) { values.push(job); filters.push(`h.jobcode = $${values.length}`); }
  if (status === 'archived') filters.push('e.is_deleted = true');
  if (status === 'active') filters.push('e.is_deleted = false AND e.sepdate IS NULL');
  if (status === 'separated') filters.push('e.is_deleted = false AND e.sepdate IS NOT NULL');
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const from = `FROM public.employee e ${latestJob} ${where}`;
  const [count, records] = await Promise.all([
    requirePool().query(`SELECT count(*)::integer AS total ${from}`, values),
    requirePool().query(`SELECT ${employeeSelect(canViewSalary(req.user))} ${from} ORDER BY e.lastname NULLS LAST, e.firstname NULLS LAST, e.empno LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit])
  ]);
  const total = count.rows[0].total;
  res.json({ success: true, data: {
    employees: records.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  } });
});

const listOptions = asyncHandler(async (_req, res) => {
  const [departments, jobs] = await Promise.all([
    requirePool().query('SELECT deptcode AS code, deptname AS name FROM public.department WHERE is_deleted = false ORDER BY deptname'),
    requirePool().query('SELECT jobcode AS code, jobdesc AS name FROM public.job WHERE is_deleted = false ORDER BY jobdesc')
  ]);
  res.json({ success: true, data: { departments: departments.rows, jobs: jobs.rows } });
});

const getEmployee = asyncHandler(async (req, res) => {
  const record = await requirePool().query(`SELECT ${employeeSelect(canViewSalary(req.user))} FROM public.employee e ${latestJob} WHERE e.empno = $1`, [req.params.empno]);
  if (!record.rows[0]) throw requestError('Employee not found', 404);
  const history = await requirePool().query(`SELECT h.empno, h.jobcode, h.deptcode, h.effdate::text AS effdate,
    j.jobdesc, d.deptname, ${canViewSalary(req.user) ? 'h.salary' : 'NULL::numeric'} AS salary, h.stamp
    FROM public.jobhistory h
    LEFT JOIN public.job j ON j.jobcode = h.jobcode
    LEFT JOIN public.department d ON d.deptcode = h.deptcode
    WHERE h.empno = $1 AND h.is_deleted = $2 ORDER BY h.effdate DESC, h.jobcode DESC`, [req.params.empno, record.rows[0].is_deleted]);
  res.json({ success: true, data: { employee: record.rows[0], history: history.rows } });
});

function validatePayload(body, salaryRequired) {
  const source = body || {};
  const requiredText = (key, max) => {
    const value = typeof source[key] === 'string' ? source[key].trim() : '';
    if (!value || value.length > max) throw requestError(`${key} is required and must be at most ${max} characters`, 400);
    return value;
  };
  const optionalDate = (key) => {
    const value = source[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw requestError(`${key} must be a valid date`, 400);
    return value;
  };
  const firstname = requiredText('firstname', 15);
  const lastname = requiredText('lastname', 15);
  const email = requiredText('email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw requestError('Enter a valid work email address', 400);
  const hiredate = optionalDate('hiredate');
  if (!hiredate) throw requestError('hiredate is required', 400);
  const sepdate = optionalDate('sepdate');
  if (sepdate && sepdate < hiredate) throw requestError('Separation date cannot be before hire date', 400);
  const birthdate = optionalDate('birthdate');
  const gender = source.gender === 'M' || source.gender === 'F' ? source.gender : null;
  const jobcode = requiredText('jobcode', 4);
  const deptcode = requiredText('deptcode', 4);
  const effdate = optionalDate('effdate') || hiredate;
  if (effdate < hiredate) throw requestError('Job effective date cannot be before hire date', 400);
  const salary = Number(source.salary);
  if (salaryRequired && (source.salary === null || source.salary === '' || !Number.isFinite(salary) || salary < 0)) throw requestError('A non-negative salary is required', 400);
  return { firstname, lastname, email, hiredate, sepdate, birthdate, gender, jobcode, deptcode, effdate, salary };
}

async function withAudit(username, callback) {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.username', username || 'anonymous']);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function validateReferences(client, values) {
  const refs = await client.query(`SELECT
    EXISTS(SELECT 1 FROM public.job WHERE jobcode = $1 AND is_deleted = false) AS job,
    EXISTS(SELECT 1 FROM public.department WHERE deptcode = $2 AND is_deleted = false) AS department`, [values.jobcode, values.deptcode]);
  if (!refs.rows[0].job || !refs.rows[0].department) throw requestError('Choose a valid job title and department', 400);
}

function handleWriteError(error) {
  if (error.code === '23505') throw requestError('That employee email or job-history entry already exists', 409);
  if (error.code === '23503') throw requestError('The selected job or department no longer exists', 400);
  throw error;
}

const createEmployee = asyncHandler(async (req, res) => {
  const values = validatePayload(req.body, true);
  try {
    const empno = await withAudit(req.user.email, async (client) => {
      await validateReferences(client, values);
      await client.query('SELECT pg_advisory_xact_lock($1)', [710031]);
      const next = await client.query(`SELECT coalesce(max(empno::integer), 0) + 1 AS id FROM public.employee WHERE empno ~ '^[0-9]{5}$'`);
      if (next.rows[0].id > 99999) throw requestError('Employee ID capacity reached', 409);
      const id = String(next.rows[0].id).padStart(5, '0');
      await client.query(`INSERT INTO public.employee (empno, firstname, lastname, email, gender, birthdate, hiredate, sepdate, is_deleted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`, [id, values.firstname, values.lastname, values.email, values.gender, values.birthdate, values.hiredate, values.sepdate]);
      await client.query(`INSERT INTO public.jobhistory (empno, jobcode, deptcode, effdate, salary, is_deleted)
        VALUES ($1,$2,$3,$4,$5,false)`, [id, values.jobcode, values.deptcode, values.effdate, values.salary]);
      return id;
    });
    res.status(201).json({ success: true, data: { empno } });
  } catch (error) { handleWriteError(error); }
});

const updateEmployee = asyncHandler(async (req, res) => {
  const values = validatePayload(req.body, true);
  try {
    const empno = await withAudit(req.user.email, async (client) => {
      const existing = await client.query('SELECT empno FROM public.employee WHERE empno = $1 AND is_deleted = false FOR UPDATE', [req.params.empno]);
      if (!existing.rows[0]) throw requestError('Employee not found', 404);
      await validateReferences(client, values);
      await client.query(`UPDATE public.employee SET firstname=$1, lastname=$2, email=$3, gender=$4, birthdate=$5, hiredate=$6, sepdate=$7 WHERE empno=$8`,
        [values.firstname, values.lastname, values.email, values.gender, values.birthdate, values.hiredate, values.sepdate, req.params.empno]);
      const latest = await client.query(`SELECT jobcode, deptcode, salary, effdate::text AS effdate FROM public.jobhistory WHERE empno=$1 AND is_deleted=false ORDER BY effdate DESC, jobcode DESC LIMIT 1`, [req.params.empno]);
      const current = latest.rows[0];
      if (!current || current.jobcode !== values.jobcode || current.deptcode !== values.deptcode || Number(current.salary) !== values.salary) {
        if (current && values.effdate < current.effdate) throw requestError('Job effective date cannot precede the latest job record', 400);
        await client.query(`INSERT INTO public.jobhistory (empno, jobcode, deptcode, effdate, salary, is_deleted) VALUES ($1,$2,$3,$4,$5,false)
          ON CONFLICT (empno, jobcode, effdate) DO UPDATE SET deptcode=EXCLUDED.deptcode, salary=EXCLUDED.salary, is_deleted=false`,
          [req.params.empno, values.jobcode, values.deptcode, values.effdate, values.salary]);
      }
      return req.params.empno;
    });
    res.json({ success: true, data: { empno } });
  } catch (error) { handleWriteError(error); }
});

const archiveEmployee = asyncHandler(async (req, res) => {
  const empno = String(req.params.empno || '').trim();
  let archivedEmpno;
  try {
    archivedEmpno = await withAudit(req.user.email, async (client) => {
      const existing = await client.query('SELECT empno FROM public.employee WHERE empno = $1 AND is_deleted = false FOR UPDATE', [empno]);
      if (!existing.rows.length) return null;
      const activeSale = await client.query('SELECT 1 FROM public.sales WHERE empno = $1 AND is_deleted = false LIMIT 1', [empno]);
      if (activeSale.rows.length) throw requestError('Cannot archive employee while active sales records exist.', 409);
      await client.query('UPDATE public.jobhistory SET is_deleted = true WHERE empno = $1 AND is_deleted = false', [empno]);
      const result = await client.query('UPDATE public.employee SET is_deleted = true WHERE empno = $1 AND is_deleted = false RETURNING empno', [empno]);
      return result.rows[0]?.empno || null;
    });
  } catch (error) {
    if (error.code === 'P0001' && /active related record/i.test(error.message || '')) {
      throw requestError('Cannot archive employee while active sales records exist.', 409);
    }
    throw error;
  }
  if (!archivedEmpno) throw requestError('Employee not found', 404);
  res.json({ success: true, data: { empno: archivedEmpno } });
});

const restoreEmployee = asyncHandler(async (req, res) => {
  const empno = String(req.params.empno || '').trim();
  const restoredEmpno = await withAudit(req.user.email, async (client) => {
    const existing = await client.query('SELECT empno FROM public.employee WHERE empno = $1 AND is_deleted = true FOR UPDATE', [empno]);
    if (!existing.rows.length) return null;
    const result = await client.query('UPDATE public.employee SET is_deleted = false WHERE empno = $1 AND is_deleted = true RETURNING empno', [empno]);
    await client.query('UPDATE public.jobhistory SET is_deleted = false WHERE empno = $1 AND is_deleted = true', [empno]);
    return result.rows[0]?.empno || null;
  });
  if (!restoredEmpno) throw requestError('Employee not found', 404);
  res.json({ success: true, data: { empno: restoredEmpno } });
});

const listJobs = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 100000);
  const limit = positiveInteger(req.query.limit, 10, 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
  if (!['all', 'active', 'archived'].includes(status)) throw requestError('Invalid status filter', 400);
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(jobcode ILIKE $${values.length} OR jobdesc ILIKE $${values.length})`);
  }
  if (status !== 'all') {
    values.push(status === 'archived');
    filters.push(`is_deleted = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [count, records] = await Promise.all([
    requirePool().query(`SELECT count(*)::integer AS total FROM public.job ${where}`, values),
    requirePool().query(`SELECT jobcode, jobdesc, is_deleted, stamp FROM public.job ${where} ORDER BY jobcode ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit])
  ]);
  const total = count.rows[0].total;
  res.json({ success: true, data: { jobs: records.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
});

const createJob = asyncHandler(async (req, res) => {
  const jobcode = typeof req.body?.jobcode === 'string' ? req.body.jobcode.trim().toUpperCase() : '';
  const jobdesc = typeof req.body?.jobdesc === 'string' ? req.body.jobdesc.trim() : '';
  if (!jobcode || jobcode.length > 4) throw requestError('Job code is required and must be at most 4 characters', 400);
  if (!jobdesc || jobdesc.length > 20) throw requestError('Job description is required and must be at most 20 characters', 400);
  try {
    const job = await withAudit(req.user.email, async (client) => {
      const result = await client.query('INSERT INTO public.job (jobcode, jobdesc, is_deleted) VALUES ($1, $2, false) RETURNING jobcode, jobdesc, is_deleted, stamp', [jobcode, jobdesc]);
      return result.rows[0];
    });
    res.status(201).json({ success: true, data: { job } });
  } catch (error) {
    if (error.code === '23505') throw requestError('A job with that code already exists', 409);
    throw error;
  }
});

const updateJob = asyncHandler(async (req, res) => {
  const jobcode = String(req.params.jobcode || '').trim().toUpperCase();
  const jobdesc = typeof req.body?.jobdesc === 'string' ? req.body.jobdesc.trim() : '';
  if (!jobdesc || jobdesc.length > 20) throw requestError('Job description is required and must be at most 20 characters', 400);
  const job = await withAudit(req.user.email, async (client) => {
    const result = await client.query('UPDATE public.job SET jobdesc = $1 WHERE jobcode = $2 AND is_deleted = false RETURNING jobcode, jobdesc, is_deleted, stamp', [jobdesc, jobcode]);
    return result.rows[0] || null;
  });
  if (!job) throw requestError('Job not found', 404);
  res.json({ success: true, data: { job } });
});

const archiveJob = asyncHandler(async (req, res) => {
  const jobcode = String(req.params.jobcode || '').trim().toUpperCase();
  let job;
  try {
    job = await withAudit(req.user.email, async (client) => {
      const existing = await client.query('SELECT jobcode FROM public.job WHERE jobcode = $1 AND is_deleted = false FOR UPDATE', [jobcode]);
      if (!existing.rows.length) return null;
      const inUse = await client.query('SELECT 1 FROM public.jobhistory WHERE jobcode = $1 AND is_deleted = false LIMIT 1', [jobcode]);
      if (inUse.rows.length) throw requestError('Cannot archive job while active job-history records exist.', 409);
      const result = await client.query('UPDATE public.job SET is_deleted = true WHERE jobcode = $1 AND is_deleted = false RETURNING jobcode, jobdesc, is_deleted, stamp', [jobcode]);
      return result.rows[0] || null;
    });
  } catch (error) {
    if (error.code === 'P0001' && /active related record/i.test(error.message || '')) {
      throw requestError('Cannot archive job while active job-history records exist.', 409);
    }
    throw error;
  }
  if (!job) throw requestError('Job not found', 404);
  res.json({ success: true, data: { job } });
});

const restoreJob = asyncHandler(async (req, res) => {
  const jobcode = String(req.params.jobcode || '').trim().toUpperCase();
  const job = await withAudit(req.user.email, async (client) => {
    const result = await client.query('UPDATE public.job SET is_deleted = false WHERE jobcode = $1 AND is_deleted = true RETURNING jobcode, jobdesc, is_deleted, stamp', [jobcode]);
    return result.rows[0] || null;
  });
  if (!job) throw requestError('Job not found', 404);
  res.json({ success: true, data: { job } });
});

const listDepartments = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 100000);
  const limit = positiveInteger(req.query.limit, 10, 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
  if (!['all', 'active', 'archived'].includes(status)) throw requestError('Invalid status filter', 400);
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(deptcode ILIKE $${values.length} OR deptname ILIKE $${values.length})`);
  }
  if (status !== 'all') {
    values.push(status === 'archived');
    filters.push(`is_deleted = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [count, records] = await Promise.all([
    requirePool().query(`SELECT count(*)::integer AS total FROM public.department ${where}`, values),
    requirePool().query(`SELECT deptcode, deptname, is_deleted, stamp FROM public.department ${where} ORDER BY deptcode ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit])
  ]);
  const total = count.rows[0].total;
  res.json({ success: true, data: { departments: records.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
});

const createDepartment = asyncHandler(async (req, res) => {
  const deptcode = typeof req.body?.deptcode === 'string' ? req.body.deptcode.trim().toUpperCase() : '';
  const deptname = typeof req.body?.deptname === 'string' ? req.body.deptname.trim() : '';
  if (!deptcode || deptcode.length > 3) throw requestError('Department code is required and must be at most 3 characters', 400);
  if (!deptname || deptname.length > 20) throw requestError('Department name is required and must be at most 20 characters', 400);
  try {
    const department = await withAudit(req.user.email, async (client) => {
      const result = await client.query('INSERT INTO public.department (deptcode, deptname, is_deleted) VALUES ($1, $2, false) RETURNING deptcode, deptname, is_deleted, stamp', [deptcode, deptname]);
      return result.rows[0];
    });
    res.status(201).json({ success: true, data: { department } });
  } catch (error) {
    if (error.code === '23505') throw requestError('A department with that code already exists', 409);
    throw error;
  }
});

const updateDepartment = asyncHandler(async (req, res) => {
  const deptcode = String(req.params.deptcode || '').trim().toUpperCase();
  const deptname = typeof req.body?.deptname === 'string' ? req.body.deptname.trim() : '';
  if (!deptname || deptname.length > 20) throw requestError('Department name is required and must be at most 20 characters', 400);
  const department = await withAudit(req.user.email, async (client) => {
    const result = await client.query('UPDATE public.department SET deptname = $1 WHERE deptcode = $2 AND is_deleted = false RETURNING deptcode, deptname, is_deleted, stamp', [deptname, deptcode]);
    return result.rows[0] || null;
  });
  if (!department) throw requestError('Department not found', 404);
  res.json({ success: true, data: { department } });
});

const archiveDepartment = asyncHandler(async (req, res) => {
  const deptcode = String(req.params.deptcode || '').trim().toUpperCase();
  let department;
  try {
    department = await withAudit(req.user.email, async (client) => {
      const existing = await client.query('SELECT deptcode FROM public.department WHERE deptcode = $1 AND is_deleted = false FOR UPDATE', [deptcode]);
      if (!existing.rows.length) return null;
      const inUse = await client.query('SELECT 1 FROM public.jobhistory WHERE deptcode = $1 AND is_deleted = false LIMIT 1', [deptcode]);
      if (inUse.rows.length) throw requestError('Cannot archive department while active job-history records exist.', 409);
      const result = await client.query('UPDATE public.department SET is_deleted = true WHERE deptcode = $1 AND is_deleted = false RETURNING deptcode, deptname, is_deleted, stamp', [deptcode]);
      return result.rows[0] || null;
    });
  } catch (error) {
    if (error.code === 'P0001' && /active related record/i.test(error.message || '')) {
      throw requestError('Cannot archive department while active job-history records exist.', 409);
    }
    throw error;
  }
  if (!department) throw requestError('Department not found', 404);
  res.json({ success: true, data: { department } });
});

const restoreDepartment = asyncHandler(async (req, res) => {
  const deptcode = String(req.params.deptcode || '').trim().toUpperCase();
  const department = await withAudit(req.user.email, async (client) => {
    const result = await client.query('UPDATE public.department SET is_deleted = false WHERE deptcode = $1 AND is_deleted = true RETURNING deptcode, deptname, is_deleted, stamp', [deptcode]);
    return result.rows[0] || null;
  });
  if (!department) throw requestError('Department not found', 404);
  res.json({ success: true, data: { department } });
});

module.exports = {
  listEmployees,
  listOptions,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  listJobs,
  createJob,
  updateJob,
  archiveJob,
  restoreJob,
  listDepartments,
  createDepartment,
  updateDepartment,
  archiveDepartment,
  restoreDepartment
};
