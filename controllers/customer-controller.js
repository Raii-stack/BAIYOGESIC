const { requirePool } = require('../db');
const { nextCustomerId } = require('../lib/customer-id');
const { asyncHandler } = require('../middleware/error-handler');

const PAYMENT_TERMS = new Set(['COD', '30D', '45D', '60D']);
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function requestError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function sanitizeText(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return maximum ? Math.min(parsed, maximum) : parsed;
}

function validateCustomerPayload(body) {
  const source = body || {};
  const custname = typeof source.custname === 'string'
    ? sanitizeText(source.custname)
    : typeof source.customerName === 'string'
      ? sanitizeText(source.customerName)
      : '';
  const address = typeof source.address === 'string' ? sanitizeText(source.address) : '';
  const payterm = typeof source.payterm === 'string'
    ? source.payterm.trim().toUpperCase()
    : typeof source.paymentTerm === 'string'
      ? source.paymentTerm.trim().toUpperCase()
      : '';

  const details = {};
  if (!custname) details.custname = 'Customer Name is required';
  else if (custname.length > 20) details.custname = 'Customer Name must be 20 characters or fewer';
  if (!address) details.address = 'Address is required';
  else if (address.length > 50) details.address = 'Address must be 50 characters or fewer';
  if (!PAYMENT_TERMS.has(payterm)) {
    details.payterm = 'Payment term must be one of: 30D, 45D, 60D, COD';
  }
  if (Object.keys(details).length) {
    throw requestError('Validation failed', 400, details);
  }

  return { custname, address, payterm };
}

async function withAuditContext(username, callback) {
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
  } finally {
    client.release();
  }
}

const listCustomers = asyncHandler(async (req, res) => {
  const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
  const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const payterm = typeof req.query.payterm === 'string' ? req.query.payterm.trim().toUpperCase() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
  if (payterm && !PAYMENT_TERMS.has(payterm)) {
    throw requestError('payterm must be COD, 30D, 45D, or 60D', 400);
  }
  if (!['all', 'active', 'archived'].includes(status)) {
    throw requestError('status must be all, active, or archived', 400);
  }
  const offset = (page - 1) * limit;
  const values = [];
  const filters = [];

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(custno ILIKE $${values.length} OR custname ILIKE $${values.length} OR address ILIKE $${values.length})`);
  }
  if (payterm) {
    values.push(payterm);
    filters.push(`payterm = $${values.length}`);
  }
  if (status !== 'all') {
    values.push(status === 'archived');
    filters.push(`is_deleted = $${values.length}`);
  }

  const filterValues = [...values];
  values.push(limit, offset);
  const limitParameter = values.length - 1;
  const offsetParameter = values.length;
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await requirePool().query(
    `SELECT custno, custname, address, payterm, is_deleted, stamp
     FROM public.customer
     ${whereClause}
     ORDER BY custname ASC, custno ASC
     LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    values
  );

  const countResult = await requirePool().query(
    `SELECT count(*)::integer AS total
     FROM public.customer
     ${whereClause}`,
    filterValues
  );
  const total = countResult.rows[0].total;

  res.json({
    success: true,
    data: {
      customers: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    }
  });
});

const createCustomer = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { custname, address, payterm } = validateCustomerPayload(body);
  const requestedCustno = typeof body.custno === 'string' ? body.custno.trim() : '';
  if (requestedCustno.length > 5) {
    throw requestError('Validation failed', 400, {
      custno: 'Customer ID must be 5 characters or fewer'
    });
  }

  let customer;
  try {
    customer = await withAuditContext(req.user?.email || 'system', async (client) => {
      const custno = requestedCustno || await nextCustomerId(client);
      const duplicate = await client.query(
        `SELECT 1
         FROM public.customer
         WHERE is_deleted = false
           AND lower(trim(custname)) = lower(trim($1))
         LIMIT 1`,
        [custname]
      );
      if (duplicate.rows.length) {
        throw requestError('A customer with that name already exists', 409, {
          custname: 'An active customer with this name already exists'
        });
      }
      const result = await client.query(
        `INSERT INTO public.customer (custno, custname, address, payterm, is_deleted)
         VALUES ($1, $2, $3, $4, false)
         RETURNING custno, custname, address, payterm, is_deleted, stamp`,
        [custno, custname, address, payterm]
      );
      return result.rows[0];
    });
  } catch (error) {
    if (error.code === '23505') {
      throw requestError('A customer with that custno already exists', 409);
    }
    throw error;
  }

  res.status(201).json({ success: true, data: { customer } });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { custname, address, payterm } = validateCustomerPayload(req.body);
  const custno = typeof req.params.custno === 'string' ? req.params.custno.trim() : '';

  if (!custno) {
    throw requestError('Validation failed', 400, { custno: 'Customer ID is required' });
  }

  const customer = await withAuditContext(req.user?.email || 'system', async (client) => {
    const duplicate = await client.query(
      `SELECT 1
       FROM public.customer
       WHERE is_deleted = false
         AND custno <> $1
         AND lower(trim(custname)) = lower(trim($2))
       LIMIT 1`,
      [custno, custname]
    );
    if (duplicate.rows.length) {
      throw requestError('A customer with that name already exists', 409, {
        custname: 'An active customer with this name already exists'
      });
    }
    const result = await client.query(
      `UPDATE public.customer
       SET custname = $1, address = $2, payterm = $3
       WHERE custno = $4
         AND is_deleted = false
       RETURNING custno, custname, address, payterm, is_deleted, stamp`,
      [custname, address, payterm, custno]
    );
    return result.rows[0] || null;
  });

  if (!customer) {
    throw requestError('Customer not found', 404);
  }

  res.json({ success: true, data: { customer } });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const custno = typeof req.params.custno === 'string' ? req.params.custno.trim() : '';

  if (!custno) {
    throw requestError('custno is required', 400);
  }
  try {
    const customer = await withAuditContext(req.user?.email || 'system', async (client) => {
      const existing = await client.query(
        'SELECT custno FROM public.customer WHERE custno = $1 AND is_deleted = false FOR UPDATE',
        [custno]
      );
      if (!existing.rows.length) return null;

      const activeSale = await client.query(
        'SELECT 1 FROM public.sales WHERE custno = $1 AND is_deleted = false LIMIT 1',
        [custno]
      );
      if (activeSale.rows.length) {
        throw requestError('Cannot archive customer while active sales records exist.', 409);
      }

      const result = await client.query(
        `UPDATE public.customer
         SET is_deleted = true
         WHERE custno = $1
           AND is_deleted = false
         RETURNING custno, custname, address, payterm, is_deleted, stamp`,
        [custno]
      );
      return result.rows[0] || null;
    });

    if (!customer) {
      throw requestError('Customer not found', 404);
    }

    res.json({ success: true, data: { customer } });
  } catch (error) {
    if (error.code === 'P0001' && /Cannot delete customer row: \d+ active related record\(s\) still exist\./i.test(error.message || '')) {
      throw requestError('Cannot archive customer while active sales records exist.', 409);
    }
    throw error;
  }
});

const restoreCustomer = asyncHandler(async (req, res) => {
  const custno = typeof req.params.custno === 'string' ? req.params.custno.trim() : '';

  if (!custno) {
    throw requestError('custno is required', 400);
  }
  const customer = await withAuditContext(req.user?.email || 'system', async (client) => {
    const result = await client.query(
      `UPDATE public.customer
       SET is_deleted = false
       WHERE custno = $1
         AND is_deleted = true
       RETURNING custno, custname, address, payterm, is_deleted, stamp`,
      [custno]
    );
    return result.rows[0] || null;
  });

  if (!customer) {
    throw requestError('Customer not found', 404);
  }

  res.json({ success: true, data: { customer } });
});

module.exports = {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer
};
