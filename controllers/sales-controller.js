const { requirePool } = require('../db');
const {
  roundCurrency,
  calculateLineTotal,
  calculateOrderTotals,
  nextTransactionNo,
  nextOfficialReceiptNo,
  validateSalePayload
} = require('../lib/sales-calculations');
const { asyncHandler } = require('../middleware/error-handler');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function requestError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
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

function formatSaleEntity(header, lineRows = [], paymentRows = [], taxRate = 0) {
  const lines = lineRows.map((row) => {
    const quantity = roundCurrency(Number(row.quantity ?? 0));
    const unitPrice = roundCurrency(Number(row.unitprice ?? row.unitPrice ?? 0));
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const isDeleted = Boolean(row.is_deleted);
    return {
      id: `${row.transno}-${row.prodcode}`,
      transno: row.transno,
      prodcode: row.prodcode,
      productCode: row.prodcode,
      description: row.description || row.prodcode,
      productName: row.description || row.prodcode,
      unit: row.unit || 'pc',
      quantity,
      qty: quantity,
      unitprice: unitPrice,
      unitPrice,
      lineTotal,
      line_total: lineTotal,
      effdate: row.effdate || null,
      is_deleted: isDeleted,
      status: isDeleted ? 'Inactive' : 'Active',
      stamp: row.stamp || ''
    };
  });

  const payments = paymentRows.map((row) => {
    const amount = roundCurrency(Number(row.amount ?? 0));
    const isDeleted = Boolean(row.is_deleted);
    const dateStr = row.paydate ? String(row.paydate).slice(0, 10) : '';
    return {
      id: row.orno,
      orno: row.orno,
      orNo: row.orno,
      paydate: dateStr,
      date: dateStr,
      payment_date: dateStr,
      amount,
      transno: row.transno,
      is_deleted: isDeleted,
      status: isDeleted ? 'Inactive' : 'Active',
      stamp: row.stamp || ''
    };
  });

  const linesForTotal = header.is_deleted
    ? lines.map((line) => ({ ...line, is_deleted: false, status: 'Active' }))
    : lines;
  const totals = calculateOrderTotals(linesForTotal, payments, taxRate);

  const salesDateStr = header.salesdate ? String(header.salesdate).slice(0, 10) : '';
  const customerName = header.custname || header.custno || '';
  const employeeName = [header.firstname, header.lastname].filter(Boolean).join(' ').trim() || header.empname || header.empno || '';
  const isDeleted = Boolean(header.is_deleted);

  return {
    transno: header.transno,
    transactionNo: header.transno,
    salesdate: salesDateStr,
    salesDate: salesDateStr,
    custno: header.custno,
    customerCode: header.custno,
    custname: customerName,
    customerName,
    empno: header.empno,
    employeeCode: header.empno,
    empname: employeeName,
    employeeName,
    is_deleted: isDeleted,
    status: isDeleted ? 'Inactive' : 'Active',
    stamp: header.stamp || '',
    lines,
    lineItems: lines,
    payments: payments.filter((payment) => !payment.is_deleted),
    ...totals
  };
}

async function hydrateSales(executor, headers, taxRate = 0) {
  if (!headers.length) return [];
  const transnos = headers.map((row) => row.transno);

  const [linesResult, paymentsResult] = await Promise.all([
    executor.query(
      `SELECT sd.transno, sd.prodcode, sd.quantity, sd.is_deleted, sd.stamp,
              p.description, p.unit,
              COALESCE(ph.unitprice, ph_any.unitprice, 0) AS unitprice,
              COALESCE(ph.effdate::text, ph_any.effdate::text) AS effdate
       FROM public.salesdetail sd
       JOIN public.sales s ON s.transno = sd.transno
       LEFT JOIN public.product p ON p.prodcode = sd.prodcode
       LEFT JOIN LATERAL (
         SELECT unitprice, effdate
         FROM public.pricehist ph
         WHERE ph.prodcode = sd.prodcode
           AND ph.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
           AND ph.is_deleted = false
         ORDER BY ph.effdate DESC
         LIMIT 1
       ) ph ON true
       LEFT JOIN LATERAL (
         SELECT unitprice, effdate
         FROM public.pricehist ph2
         WHERE ph2.prodcode = sd.prodcode
           AND ph2.effdate <= COALESCE(s.salesdate, CURRENT_DATE)
         ORDER BY ph2.effdate DESC
         LIMIT 1
       ) ph_any ON true
       WHERE sd.transno = ANY($1::varchar[])
       ORDER BY sd.transno ASC, sd.prodcode ASC`,
      [transnos]
    ),
    executor.query(
      `SELECT orno, paydate::text AS paydate, amount, transno, is_deleted, stamp
       FROM public.payment
       WHERE transno = ANY($1::varchar[])
         AND is_deleted = false
       ORDER BY paydate ASC, orno ASC`,
      [transnos]
    )
  ]);

  const linesByTransno = new Map();
  for (const row of linesResult.rows) {
    if (!linesByTransno.has(row.transno)) linesByTransno.set(row.transno, []);
    linesByTransno.get(row.transno).push(row);
  }

  const paymentsByTransno = new Map();
  for (const row of paymentsResult.rows) {
    if (!paymentsByTransno.has(row.transno)) paymentsByTransno.set(row.transno, []);
    paymentsByTransno.get(row.transno).push(row);
  }

  return headers.map((header) =>
    formatSaleEntity(
      header,
      linesByTransno.get(header.transno) || [],
      paymentsByTransno.get(header.transno) || [],
      taxRate
    )
  );
}

async function fetchSingleSale(executor, transno, taxRate = 0) {
  const headerResult = await executor.query(
    `SELECT s.transno, s.salesdate::text AS salesdate, s.custno, s.empno, s.is_deleted, s.stamp,
            c.custname, e.firstname, e.lastname
     FROM public.sales s
     LEFT JOIN public.customer c ON c.custno = s.custno
     LEFT JOIN public.employee e ON e.empno = s.empno
     WHERE s.transno = $1`,
    [transno]
  );
  if (!headerResult.rows.length) return null;
  const hydrated = await hydrateSales(executor, headerResult.rows, taxRate);
  return hydrated[0] || null;
}

const listSales = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = positiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
  const status = rawStatus === 'inactive' ? 'archived' : rawStatus;
  if (!['all', 'active', 'archived'].includes(status)) {
    throw requestError('Invalid status filter', 400);
  }

  const filters = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    filters.push(
      `(s.transno ILIKE $${idx} OR s.custno ILIKE $${idx} OR COALESCE(c.custname, '') ILIKE $${idx} OR s.empno ILIKE $${idx} OR CONCAT_WS(' ', e.firstname, e.lastname) ILIKE $${idx})`
    );
  }

  if (status !== 'all') {
    values.push(status === 'archived');
    filters.push(`s.is_deleted = $${values.length}`);
  }

  const custnoFilter = typeof req.query.custno === 'string' ? req.query.custno.trim() : '';
  if (custnoFilter) {
    values.push(custnoFilter);
    filters.push(`s.custno = $${values.length}`);
  }

  const empnoFilter = typeof req.query.empno === 'string' ? req.query.empno.trim() : '';
  if (empnoFilter) {
    values.push(empnoFilter);
    filters.push(`s.empno = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countValues = [...values];
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const pool = requirePool();
  const [headersResult, countResult] = await Promise.all([
    pool.query(
      `SELECT s.transno, s.salesdate::text AS salesdate, s.custno, s.empno, s.is_deleted, s.stamp,
              c.custname, e.firstname, e.lastname
       FROM public.sales s
       LEFT JOIN public.customer c ON c.custno = s.custno
       LEFT JOIN public.employee e ON e.empno = s.empno
       ${whereClause}
       ORDER BY s.salesdate DESC NULLS LAST, s.transno DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ),
    pool.query(
      `SELECT count(*)::integer AS total
       FROM public.sales s
       LEFT JOIN public.customer c ON c.custno = s.custno
       LEFT JOIN public.employee e ON e.empno = s.empno
       ${whereClause}`,
      countValues
    )
  ]);

  const total = countResult.rows[0]?.total || 0;
  const sales = await hydrateSales(pool, headersResult.rows);

  res.json({
    success: true,
    data: {
      sales,
      transactions: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    }
  });
});

const getSalesCatalog = asyncHandler(async (_req, res) => {
  const pool = requirePool();
  const [customersResult, employeesResult, productsResult, pricesResult] = await Promise.all([
    pool.query(
      `SELECT custno, custname, address, payterm, is_deleted, stamp
       FROM public.customer
       WHERE is_deleted = false
       ORDER BY custname ASC, custno ASC`
    ),
    pool.query(
      `SELECT e.empno, e.firstname, e.lastname, e.email, e.hiredate::text AS hiredate, e.sepdate::text AS sepdate, e.is_deleted, e.stamp,
              jh.jobcode, j.jobdesc, jh.deptcode, d.deptname
       FROM public.employee e
       LEFT JOIN LATERAL (
         SELECT jobcode, deptcode
         FROM public.jobhistory jh
         WHERE jh.empno = e.empno AND jh.is_deleted = false
         ORDER BY jh.effdate DESC
         LIMIT 1
       ) jh ON true
       LEFT JOIN public.job j ON j.jobcode = jh.jobcode
       LEFT JOIN public.department d ON d.deptcode = jh.deptcode
       WHERE e.is_deleted = false AND e.sepdate IS NULL
       ORDER BY e.lastname ASC, e.firstname ASC, e.empno ASC`
    ),
    pool.query(
      `SELECT p.prodcode, p.description, p.unit, p.is_deleted, p.stamp,
              price.unitprice, price.effdate::text AS effdate
       FROM public.product p
       LEFT JOIN LATERAL (
         SELECT unitprice, effdate
         FROM public.pricehist ph
         WHERE ph.prodcode = p.prodcode
           AND ph.effdate <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
           AND ph.is_deleted = false
         ORDER BY ph.effdate DESC
         LIMIT 1
       ) price ON true
       WHERE p.is_deleted = false
       ORDER BY p.description ASC, p.prodcode ASC`
    ),
    pool.query(
      `SELECT prodcode, effdate::text AS effdate, unitprice
       FROM public.pricehist
       WHERE is_deleted = false
       ORDER BY prodcode ASC, effdate DESC`
    )
  ]);

  const pricesByProduct = new Map();
  for (const row of pricesResult.rows) {
    if (!pricesByProduct.has(row.prodcode)) pricesByProduct.set(row.prodcode, []);
    pricesByProduct.get(row.prodcode).push({
      effdate: row.effdate,
      effectiveDate: row.effdate,
      unitprice: roundCurrency(Number(row.unitprice)),
      price: roundCurrency(Number(row.unitprice))
    });
  }

  const products = productsResult.rows.map((row) => ({
    ...row,
    unitprice: row.unitprice !== null && row.unitprice !== undefined ? roundCurrency(Number(row.unitprice)) : null,
    priceHistory: pricesByProduct.get(row.prodcode) || []
  }));

  res.json({
    success: true,
    data: {
      customers: customersResult.rows,
      employees: employeesResult.rows,
      products
    }
  });
});

const lookupProductPrice = asyncHandler(async (req, res) => {
  const prodcode = String(req.params.prodcode || req.query.prodcode || '').trim();
  if (!prodcode) {
    throw requestError('Product code is required', 400);
  }

  const salesdate = typeof req.query.salesdate === 'string' && req.query.salesdate.trim()
    ? req.query.salesdate.trim()
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(salesdate) || Number.isNaN(Date.parse(salesdate))) {
    throw requestError('salesdate must be a valid date in YYYY-MM-DD format', 400);
  }

  const result = await requirePool().query(
    `SELECT ph.prodcode, ph.effdate::text AS effdate, ph.unitprice
     FROM public.pricehist ph
     WHERE ph.prodcode = $1
       AND ph.effdate <= $2::date
       AND ph.is_deleted = false
     ORDER BY ph.effdate DESC
     LIMIT 1`,
    [prodcode, salesdate]
  );

  if (!result.rows.length) {
    throw requestError(`No active price found for product ${prodcode} as of ${salesdate}`, 404);
  }

  const row = result.rows[0];
  const unitPrice = roundCurrency(Number(row.unitprice));

  res.json({
    success: true,
    data: {
      prodcode: row.prodcode,
      productCode: row.prodcode,
      salesdate,
      salesDate: salesdate,
      effdate: row.effdate,
      effectiveDate: row.effdate,
      unitprice: unitPrice,
      unitPrice,
      price: unitPrice
    }
  });
});

const getSaleByTransno = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  if (!transno) throw requestError('Transaction number is required', 400);

  const sale = await fetchSingleSale(requirePool(), transno);
  if (!sale) throw requestError('Sales transaction not found', 404);

  res.json({
    success: true,
    data: {
      sale,
      transaction: sale
    }
  });
});

const createSale = asyncHandler(async (req, res) => {
  const { custno, empno, salesdate, lines } = validateSalePayload(req.body);
  const requestedTransno = typeof (req.body?.transno ?? req.body?.transactionNo) === 'string'
    ? String(req.body.transno ?? req.body.transactionNo).trim()
    : '';
  const taxRate = Number.isFinite(Number(req.body?.taxRate)) ? Number(req.body.taxRate) : 0;

  if (requestedTransno && requestedTransno !== 'Auto-numbered on save' && requestedTransno.length > 8) {
    throw requestError('Transaction number must be 8 characters or fewer', 400, {
      transno: 'Transaction number must be 8 characters or fewer'
    });
  }

  try {
    const createdSale = await withAuditContext(req.user?.email || 'system', async (client) => {
      const customerCheck = await client.query(
        'SELECT custno, custname, is_deleted FROM public.customer WHERE custno = $1',
        [custno]
      );
      if (!customerCheck.rows.length || customerCheck.rows[0].is_deleted) {
        throw requestError('Customer not found or inactive', 400, {
          custno: 'Selected customer does not exist or is archived'
        });
      }

      const employeeCheck = await client.query(
        'SELECT empno, firstname, lastname, is_deleted, sepdate FROM public.employee WHERE empno = $1',
        [empno]
      );
      if (!employeeCheck.rows.length || employeeCheck.rows[0].is_deleted) {
        throw requestError('Salesperson not found or inactive', 400, {
          empno: 'Selected salesperson does not exist or is archived'
        });
      }

      const resolvedLines = [];
      for (const line of lines) {
        const productCheck = await client.query(
          'SELECT prodcode, description, unit, is_deleted FROM public.product WHERE prodcode = $1',
          [line.prodcode]
        );
        if (!productCheck.rows.length || productCheck.rows[0].is_deleted) {
          throw requestError(`Product ${line.prodcode} not found or inactive`, 400, {
            prodcode: `Product ${line.prodcode} does not exist or is archived`
          });
        }

        const priceLookup = await client.query(
          `SELECT unitprice, effdate::text AS effdate
           FROM public.pricehist
           WHERE prodcode = $1
             AND effdate <= $2::date
             AND is_deleted = false
           ORDER BY effdate DESC
           LIMIT 1`,
          [line.prodcode, salesdate]
        );

        const resolvedUnitPrice = priceLookup.rows.length
          ? roundCurrency(Number(priceLookup.rows[0].unitprice))
          : line.unitprice;

        if (resolvedUnitPrice === null || resolvedUnitPrice === undefined || resolvedUnitPrice <= 0) {
          throw requestError(
            `No active price found for product ${line.prodcode} as of ${salesdate}`,
            400,
            { prodcode: `No effective price found for ${line.prodcode} on or before ${salesdate}` }
          );
        }

        resolvedLines.push({
          prodcode: line.prodcode,
          quantity: line.quantity,
          unitprice: resolvedUnitPrice,
          effdate: priceLookup.rows[0]?.effdate || salesdate,
          description: productCheck.rows[0].description,
          unit: productCheck.rows[0].unit
        });
      }

      const transno = requestedTransno && requestedTransno !== 'Auto-numbered on save'
        ? requestedTransno
        : await nextTransactionNo(client);

      await client.query(
        `INSERT INTO public.sales (transno, salesdate, custno, empno, is_deleted)
         VALUES ($1, $2::date, $3, $4, false)`,
        [transno, salesdate, custno, empno]
      );

      for (const line of resolvedLines) {
        await client.query(
          `INSERT INTO public.salesdetail (transno, prodcode, quantity, is_deleted)
           VALUES ($1, $2, $3, false)`,
          [transno, line.prodcode, line.quantity]
        );
      }

      return fetchSingleSale(client, transno, taxRate);
    });

    res.status(201).json({
      success: true,
      data: {
        sale: createdSale,
        transaction: createdSale
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      throw requestError('A sales transaction with that transaction number already exists', 409);
    }
    throw error;
  }
});

const recordPayment = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  if (!transno) throw requestError('Transaction number is required', 400);

  const rawAmount = req.body?.amount;
  const amount = Number(rawAmount);
  if (rawAmount === undefined || rawAmount === null || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
    throw requestError('Payment amount must be greater than zero', 400, {
      amount: 'Payment amount must be greater than zero'
    });
  }
  const roundedAmount = roundCurrency(amount);

  const rawPaydate = String(
    req.body?.paydate ?? req.body?.payment_date ?? req.body?.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawPaydate) || Number.isNaN(Date.parse(rawPaydate))) {
    throw requestError('Payment date must be a valid date in YYYY-MM-DD format', 400, {
      paydate: 'Payment date must be a valid date in YYYY-MM-DD format'
    });
  }

  const requestedOrno = typeof (req.body?.orno ?? req.body?.orNo) === 'string'
    ? String(req.body.orno ?? req.body.orNo).trim()
    : '';

  const result = await withAuditContext(req.user?.email || 'system', async (client) => {
    const existingSale = await fetchSingleSale(client, transno);
    if (!existingSale || existingSale.is_deleted) {
      throw requestError('Sales transaction not found', 404);
    }

    if (roundedAmount > roundCurrency(existingSale.balance)) {
      throw requestError('Payment cannot exceed the remaining balance.', 400, {
        amount: `Payment amount (${roundedAmount.toFixed(2)}) exceeds remaining balance (${existingSale.balance.toFixed(2)})`
      });
    }

    const orno = requestedOrno && requestedOrno !== 'Auto-generated on save' && requestedOrno.length <= 8
      ? requestedOrno
      : await nextOfficialReceiptNo(client);

    const insertedPayment = await client.query(
      `INSERT INTO public.payment (orno, paydate, amount, transno, is_deleted)
       VALUES ($1, $2::date, $3, $4, false)
       RETURNING orno, paydate::text AS paydate, amount, transno, is_deleted, stamp`,
      [orno, rawPaydate, roundedAmount, transno]
    );

    const updatedSale = await fetchSingleSale(client, transno);
    const paymentRow = insertedPayment.rows[0];
    const dateStr = paymentRow.paydate ? String(paymentRow.paydate).slice(0, 10) : rawPaydate;

    return {
      payment: {
        id: paymentRow.orno,
        orno: paymentRow.orno,
        orNo: paymentRow.orno,
        paydate: dateStr,
        date: dateStr,
        payment_date: dateStr,
        amount: roundCurrency(Number(paymentRow.amount)),
        transno: paymentRow.transno,
        is_deleted: Boolean(paymentRow.is_deleted),
        status: paymentRow.is_deleted ? 'Inactive' : 'Active',
        stamp: paymentRow.stamp || ''
      },
      sale: updatedSale
    };
  });

  res.status(201).json({
    success: true,
    data: {
      payment: result.payment,
      sale: result.sale,
      transaction: result.sale
    }
  });
});

const updatePayment = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  const orno = String(req.params.orno || '').trim();
  if (!transno || !orno) throw requestError('Transaction number and receipt number are required', 400);

  const rawAmount = req.body?.amount;
  const amount = Number(rawAmount);
  if (rawAmount === undefined || rawAmount === null || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
    throw requestError('Payment amount must be greater than zero', 400, {
      amount: 'Payment amount must be greater than zero'
    });
  }
  const roundedAmount = roundCurrency(amount);

  const rawPaydate = String(
    req.body?.paydate ?? req.body?.payment_date ?? req.body?.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawPaydate) || Number.isNaN(Date.parse(rawPaydate))) {
    throw requestError('Payment date must be a valid date in YYYY-MM-DD format', 400);
  }

  const result = await withAuditContext(req.user?.email || 'system', async (client) => {
    const existingSale = await fetchSingleSale(client, transno);
    if (!existingSale || existingSale.is_deleted) {
      throw requestError('Sales transaction not found', 404);
    }

    const existingPayment = existingSale.payments.find((p) => p.orno === orno || p.id === orno);
    if (!existingPayment) {
      throw requestError('Payment record not found', 404);
    }

    const availableBalance = roundCurrency(existingSale.balance + existingPayment.amount);
    if (roundedAmount > availableBalance) {
      throw requestError('Payment cannot exceed the remaining balance.', 400, {
        amount: `Payment amount (${roundedAmount.toFixed(2)}) exceeds available balance (${availableBalance.toFixed(2)})`
      });
    }

    const updatedPayment = await client.query(
      `UPDATE public.payment
       SET paydate = $1::date, amount = $2
       WHERE orno = $3 AND transno = $4 AND is_deleted = false
       RETURNING orno, paydate::text AS paydate, amount, transno, is_deleted, stamp`,
      [rawPaydate, roundedAmount, orno, transno]
    );
    if (!updatedPayment.rows.length) {
      throw requestError('Payment record not found', 404);
    }

    const updatedSale = await fetchSingleSale(client, transno);
    const paymentRow = updatedPayment.rows[0];
    const dateStr = paymentRow.paydate ? String(paymentRow.paydate).slice(0, 10) : rawPaydate;

    return {
      payment: {
        id: paymentRow.orno,
        orno: paymentRow.orno,
        orNo: paymentRow.orno,
        paydate: dateStr,
        date: dateStr,
        payment_date: dateStr,
        amount: roundCurrency(Number(paymentRow.amount)),
        transno: paymentRow.transno,
        is_deleted: Boolean(paymentRow.is_deleted),
        status: paymentRow.is_deleted ? 'Inactive' : 'Active',
        stamp: paymentRow.stamp || ''
      },
      sale: updatedSale
    };
  });

  res.json({
    success: true,
    data: {
      payment: result.payment,
      sale: result.sale,
      transaction: result.sale
    }
  });
});

const deletePayment = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  const orno = String(req.params.orno || '').trim();
  if (!transno || !orno) throw requestError('Transaction number and receipt number are required', 400);

  const sale = await withAuditContext(req.user?.email || 'system', async (client) => {
    const deleted = await client.query(
      `UPDATE public.payment
       SET is_deleted = true
       WHERE orno = $1 AND transno = $2 AND is_deleted = false
       RETURNING orno`,
      [orno, transno]
    );
    if (!deleted.rows.length) {
      throw requestError('Payment record not found', 404);
    }
    return fetchSingleSale(client, transno);
  });

  res.json({
    success: true,
    data: {
      sale,
      transaction: sale
    }
  });
});

const archiveSale = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  if (!transno) throw requestError('Transaction number is required', 400);

  let sale;
  try {
    sale = await withAuditContext(req.user?.email || 'system', async (client) => {
      const existing = await client.query(
        'SELECT transno, is_deleted FROM public.sales WHERE transno = $1 FOR UPDATE',
        [transno]
      );
      if (!existing.rows.length) return null;
      if (existing.rows[0].is_deleted) {
        return fetchSingleSale(client, transno);
      }

      const activePayment = await client.query(
        'SELECT 1 FROM public.payment WHERE transno = $1 AND is_deleted = false LIMIT 1',
        [transno]
      );
      if (activePayment.rows.length) {
        throw requestError('Cannot archive a sales order that already has recorded payments.', 409);
      }

      await client.query(
        'UPDATE public.salesdetail SET is_deleted = true WHERE transno = $1 AND is_deleted = false',
        [transno]
      );

      await client.query(
        'UPDATE public.sales SET is_deleted = true WHERE transno = $1 AND is_deleted = false',
        [transno]
      );

      return fetchSingleSale(client, transno);
    });
  } catch (error) {
    if (error.code === 'P0001' && /active related record/i.test(error.message || '')) {
      throw requestError('Cannot archive a sales order that already has recorded payments.', 409);
    }
    throw error;
  }

  if (!sale) throw requestError('Sales transaction not found', 404);

  res.json({
    success: true,
    data: {
      sale,
      transaction: sale
    }
  });
});

const restoreSale = asyncHandler(async (req, res) => {
  const transno = String(req.params.transno || '').trim();
  if (!transno) throw requestError('Transaction number is required', 400);

  const sale = await withAuditContext(req.user?.email || 'system', async (client) => {
    const existing = await client.query(
      'SELECT transno, is_deleted FROM public.sales WHERE transno = $1 FOR UPDATE',
      [transno]
    );
    if (!existing.rows.length) return null;

    if (existing.rows[0].is_deleted) {
      await client.query(
        'UPDATE public.sales SET is_deleted = false WHERE transno = $1 AND is_deleted = true',
        [transno]
      );
      await client.query(
        'UPDATE public.salesdetail SET is_deleted = false WHERE transno = $1 AND is_deleted = true',
        [transno]
      );
    }

    return fetchSingleSale(client, transno);
  });

  if (!sale) throw requestError('Sales transaction not found', 404);

  res.json({
    success: true,
    data: {
      sale,
      transaction: sale
    }
  });
});

module.exports = {
  listSales,
  getSalesCatalog,
  lookupProductPrice,
  getSaleByTransno,
  createSale,
  recordPayment,
  updatePayment,
  deletePayment,
  archiveSale,
  restoreSale
};
