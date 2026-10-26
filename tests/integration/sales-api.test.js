import { beforeEach, describe, expect, it, vi } from 'vitest';

let activePool = null;

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => activePool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const app = require('../../server');
const salesRoutes = require('../../routes/sales-routes');
const {
  listSales,
  lookupProductPrice,
  getSaleByTransno,
  createSale,
  recordPayment,
  archiveSale,
  restoreSale
} = require('../../controllers/sales-controller');
const { requirePermission } = require('../../middleware/permissions');

function createRes(onComplete) {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (onComplete) onComplete(this);
      return this;
    }
  };
}

function invokeHandler(handler, req) {
  return new Promise((resolve) => {
    const res = createRes(resolve);
    const next = (error) => {
      if (error) {
        res.statusCode = error.statusCode || 500;
        res.body = {
          success: false,
          error: {
            message: error.message,
            statusCode: res.statusCode,
            ...(error.details ? { details: error.details } : {})
          }
        };
      }
      resolve(res);
    };

    Promise.resolve(handler(req, res, next))
      .then(() => resolve(res))
      .catch(next);
  });
}

function invokeProtected(permissionMiddleware, handler, req) {
  return new Promise((resolve) => {
    const res = createRes((completedRes) => {
      if (completedRes.statusCode >= 400) {
        resolve(completedRes);
      }
    });
    permissionMiddleware(req, res, (permError) => {
      if (permError) {
        res.statusCode = permError.statusCode || 500;
        res.body = { success: false, error: { message: permError.message } };
        return resolve(res);
      }
      if (res.statusCode >= 400 && res.body) {
        return resolve(res);
      }
      invokeHandler(handler, req).then(resolve);
    });
  });
}

function createSalesMockDb() {
  const state = {
    customers: [
      { custno: 'C0001', custname: 'Acme Corporation', address: '123 Main St', payterm: '30D', is_deleted: false, stamp: 'ADD system' }
    ],
    employees: [
      { empno: '00005', firstname: 'Don', lastname: 'King', email: 'king.don@hope.inc', sepdate: null, is_deleted: false, stamp: 'ADD system' }
    ],
    products: [
      { prodcode: 'P0001', description: 'Industrial Widget A', unit: 'pc', is_deleted: false, stamp: 'ADD system' },
      { prodcode: 'P0002', description: 'Service Component B', unit: 'ea', is_deleted: false, stamp: 'ADD system' }
    ],
    pricehist: [
      { prodcode: 'P0001', effdate: '2026-01-01', unitprice: '10.00', is_deleted: false, stamp: 'ADD system' },
      { prodcode: 'P0001', effdate: '2026-09-01', unitprice: '13.75', is_deleted: false, stamp: 'ADD system' },
      { prodcode: 'P0002', effdate: '2026-01-01', unitprice: '19.40', is_deleted: false, stamp: 'ADD system' }
    ],
    sales: [
      { transno: 'TR000001', salesdate: '2026-10-01', custno: 'C0001', empno: '00005', is_deleted: false, stamp: 'ADD system' },
      { transno: 'TR000002', salesdate: '2026-10-02', custno: 'C0001', empno: '00005', is_deleted: false, stamp: 'ADD system' }
    ],
    salesdetail: [
      { transno: 'TR000001', prodcode: 'P0001', quantity: '10', is_deleted: false, stamp: 'ADD system' },
      { transno: 'TR000001', prodcode: 'P0002', quantity: '5', is_deleted: false, stamp: 'ADD system' },
      { transno: 'TR000002', prodcode: 'P0001', quantity: '2', is_deleted: false, stamp: 'ADD system' }
    ],
    payment: [
      { orno: 'OR000001', paydate: '2026-10-02', amount: '200.00', transno: 'TR000001', is_deleted: false, stamp: 'ADD system' }
    ]
  };

  const query = vi.fn(async (sql, params = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();

    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK' || text.startsWith('SELECT set_config') || text.startsWith('SELECT pg_advisory_xact_lock')) {
      return { rows: [] };
    }

    if (text.includes('FROM public.pricehist ph WHERE ph.prodcode = $1 AND ph.effdate <= $2::date') || text.includes('FROM public.pricehist WHERE prodcode = $1 AND effdate <= $2::date')) {
      const [prodcode, salesdate] = params;
      const matches = state.pricehist
        .filter((p) => p.prodcode === prodcode && !p.is_deleted && p.effdate <= salesdate)
        .sort((a, b) => b.effdate.localeCompare(a.effdate));
      return { rows: matches.slice(0, 1) };
    }

    if (text.startsWith('SELECT count(*)::integer AS total FROM public.sales s')) {
      return { rows: [{ total: state.sales.length }] };
    }

    if (text.startsWith('SELECT s.transno, s.salesdate::text AS salesdate, s.custno, s.empno, s.is_deleted, s.stamp, c.custname, e.firstname, e.lastname FROM public.sales s')) {
      let rows = state.sales.map((s) => {
        const cust = state.customers.find((c) => c.custno === s.custno);
        const emp = state.employees.find((e) => e.empno === s.empno);
        return {
          ...s,
          custname: cust?.custname || null,
          firstname: emp?.firstname || null,
          lastname: emp?.lastname || null
        };
      });
      if (text.includes('WHERE s.transno = $1')) {
        rows = rows.filter((r) => r.transno === params[0]);
      }
      return { rows };
    }

    if (text.startsWith('SELECT sd.transno, sd.prodcode, sd.quantity, sd.is_deleted, sd.stamp')) {
      const [transnos] = params;
      const rows = state.salesdetail
        .filter((sd) => transnos.includes(sd.transno))
        .map((sd) => {
          const sale = state.sales.find((s) => s.transno === sd.transno);
          const prod = state.products.find((p) => p.prodcode === sd.prodcode);
          const priceEntry = state.pricehist
            .filter((ph) => ph.prodcode === sd.prodcode && ph.effdate <= (sale?.salesdate || '9999-12-31'))
            .sort((a, b) => b.effdate.localeCompare(a.effdate))[0];
          return {
            ...sd,
            description: prod?.description || sd.prodcode,
            unit: prod?.unit || 'pc',
            unitprice: priceEntry?.unitprice || '0',
            effdate: priceEntry?.effdate || null
          };
        });
      return { rows };
    }

    if (text.startsWith('SELECT orno, paydate::text AS paydate, amount, transno, is_deleted, stamp FROM public.payment')) {
      const [transnos] = params;
      const rows = state.payment.filter((p) => transnos.includes(p.transno) && !p.is_deleted);
      return { rows };
    }

    if (text.startsWith('SELECT custno, custname, is_deleted FROM public.customer WHERE custno = $1')) {
      return { rows: state.customers.filter((c) => c.custno === params[0]) };
    }

    if (text.startsWith('SELECT empno, firstname, lastname, is_deleted, sepdate FROM public.employee WHERE empno = $1')) {
      return { rows: state.employees.filter((e) => e.empno === params[0]) };
    }

    if (text.startsWith('SELECT prodcode, description, unit, is_deleted FROM public.product WHERE prodcode = $1')) {
      return { rows: state.products.filter((p) => p.prodcode === params[0]) };
    }

    if (text.includes('FROM public.sales WHERE transno ~')) {
      const maxNum = state.sales.reduce((max, s) => {
        const num = Number.parseInt(s.transno.slice(2), 10) || 0;
        return Math.max(max, num);
      }, 0);
      return { rows: [{ next_number: maxNum + 1 }] };
    }

    if (text.includes('FROM public.payment WHERE orno ~')) {
      const maxNum = state.payment.reduce((max, p) => {
        const num = Number.parseInt(p.orno.slice(2), 10) || 0;
        return Math.max(max, num);
      }, 0);
      return { rows: [{ next_number: maxNum + 1 }] };
    }

    if (text.startsWith('INSERT INTO public.sales ')) {
      const [transno, salesdate, custno, empno] = params;
      state.sales.unshift({ transno, salesdate, custno, empno, is_deleted: false, stamp: 'ADD test' });
      return { rows: [] };
    }

    if (text.startsWith('INSERT INTO public.salesdetail ')) {
      const [transno, prodcode, quantity] = params;
      state.salesdetail.push({ transno, prodcode, quantity: String(quantity), is_deleted: false, stamp: 'ADD test' });
      return { rows: [] };
    }

    if (text.startsWith('INSERT INTO public.payment ')) {
      const [orno, paydate, amount, transno] = params;
      const row = { orno, paydate, amount: String(amount), transno, is_deleted: false, stamp: 'ADD test' };
      state.payment.push(row);
      return { rows: [row] };
    }

    if (text.startsWith('SELECT transno, is_deleted FROM public.sales WHERE transno = $1 FOR UPDATE')) {
      return { rows: state.sales.filter((s) => s.transno === params[0]) };
    }

    if (text.startsWith('SELECT 1 FROM public.payment WHERE transno = $1 AND is_deleted = false')) {
      const hasPayment = state.payment.some((p) => p.transno === params[0] && !p.is_deleted);
      return { rows: hasPayment ? [{ '?column?': 1 }] : [] };
    }

    if (text.startsWith('UPDATE public.salesdetail SET is_deleted = true WHERE transno = $1')) {
      state.salesdetail.forEach((sd) => {
        if (sd.transno === params[0]) sd.is_deleted = true;
      });
      return { rows: [] };
    }

    if (text.startsWith('UPDATE public.sales SET is_deleted = true WHERE transno = $1')) {
      state.sales.forEach((s) => {
        if (s.transno === params[0]) {
          s.is_deleted = true;
          s.stamp = 'DELETE test';
        }
      });
      return { rows: [] };
    }

    if (text.startsWith('UPDATE public.sales SET is_deleted = false WHERE transno = $1')) {
      state.sales.forEach((s) => {
        if (s.transno === params[0]) {
          s.is_deleted = false;
          s.stamp = 'RESTORE test';
        }
      });
      return { rows: [] };
    }

    if (text.startsWith('UPDATE public.salesdetail SET is_deleted = false WHERE transno = $1')) {
      state.salesdetail.forEach((sd) => {
        if (sd.transno === params[0]) sd.is_deleted = false;
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in sales mock: ${text}`);
  });

  const pool = {
    query,
    connect: vi.fn(async () => ({
      query,
      release: vi.fn()
    }))
  };

  return { state, pool };
}

describe('Issue #71: Sales Transaction Header & Line Items API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const mockDb = createSalesMockDb();
    activePool = mockDb.pool;
  });

  it('GET /api/sales returns sales orders with accurate line subtotals, payments, and remaining balance', async () => {
    const res = await invokeProtected(
      requirePermission('Sales', 'view'),
      listSales,
      {
        query: { page: '1', limit: '25' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const first = res.body.data.sales.find((s) => s.transno === 'TR000001');
    expect(first).toBeDefined();
    expect(first.totalAmount).toBe(234.5);
    expect(first.amountPaid).toBe(200);
    expect(first.balance).toBe(34.5);
    expect(first.paymentStatus).toBe('Partial');
  });

  it('GET /api/sales/price-lookup returns the active price effective as of the sales date', async () => {
    const historicalRes = await invokeProtected(
      requirePermission('Sales', 'view'),
      lookupProductPrice,
      {
        params: {},
        query: { prodcode: 'P0001', salesdate: '2026-05-15' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(historicalRes.statusCode).toBe(200);
    expect(historicalRes.body.data.unitPrice).toBe(10);
    expect(historicalRes.body.data.effectiveDate).toBe('2026-01-01');

    const currentRes = await invokeProtected(
      requirePermission('Sales', 'view'),
      lookupProductPrice,
      {
        params: {},
        query: { prodcode: 'P0001', salesdate: '2026-10-15' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(currentRes.statusCode).toBe(200);
    expect(currentRes.body.data.unitPrice).toBe(13.75);
    expect(currentRes.body.data.effectiveDate).toBe('2026-09-01');
  });

  it('POST /api/sales creates a transaction with header, line items, and price lookup as of salesdate', async () => {
    const res = await invokeProtected(
      requirePermission('Sales', 'edit'),
      createSale,
      {
        body: {
          custno: 'C0001',
          empno: '00005',
          salesdate: '2026-05-10',
          lines: [
            { prodcode: 'P0001', quantity: 4 },
            { prodcode: 'P0002', quantity: 2 }
          ]
        },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    const created = res.body.data.sale;
    expect(created.transno).toBe('TR000003');
    expect(created.subtotal).toBe(78.8);
    expect(created.totalAmount).toBe(78.8);
    expect(created.balance).toBe(78.8);
    expect(created.paymentStatus).toBe('Unpaid');
  });

  it('POST /api/sales returns HTTP 400 when item quantity is zero or negative', async () => {
    const zeroRes = await invokeProtected(
      requirePermission('Sales', 'edit'),
      createSale,
      {
        body: {
          custno: 'C0001',
          empno: '00005',
          salesdate: '2026-10-15',
          lines: [{ prodcode: 'P0001', quantity: 0 }]
        },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(zeroRes.statusCode).toBe(400);
    expect(zeroRes.body.error.message).toMatch(/greater than zero/i);
  });

  it('POST /api/sales/:transno/payments records payment and blocks overpayment with HTTP 400', async () => {
    const overpayRes = await invokeProtected(
      requirePermission('Sales', 'edit'),
      recordPayment,
      {
        params: { transno: 'TR000001' },
        body: { amount: 50, paydate: '2026-10-10' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(overpayRes.statusCode).toBe(400);
    expect(overpayRes.body.error.message).toMatch(/exceed/i);

    const validPayRes = await invokeProtected(
      requirePermission('Sales', 'edit'),
      recordPayment,
      {
        params: { transno: 'TR000001' },
        body: { amount: 34.5, paydate: '2026-10-10' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(validPayRes.statusCode).toBe(201);
    expect(validPayRes.body.data.sale.balance).toBe(0);
    expect(validPayRes.body.data.sale.paymentStatus).toBe('Paid');
  });

  it('DELETE /api/sales/:transno returns HTTP 409 when payments exist, and archives/restores unpaid orders', async () => {
    const conflictRes = await invokeProtected(
      requirePermission('Sales', 'delete'),
      archiveSale,
      {
        params: { transno: 'TR000001' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(conflictRes.statusCode).toBe(409);
    expect(conflictRes.body.error.message).toMatch(/recorded payments/i);

    const archiveRes = await invokeProtected(
      requirePermission('Sales', 'delete'),
      archiveSale,
      {
        params: { transno: 'TR000002' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.body.data.sale.status).toBe('Inactive');

    const restoreRes = await invokeProtected(
      requirePermission('Sales', 'delete'),
      restoreSale,
      {
        params: { transno: 'TR000002' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      }
    );
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.body.data.sale.status).toBe('Active');
  });

  it('enforces RBAC permissions returning HTTP 403 Forbidden for unauthorized users', async () => {
    const forbiddenCreate = await invokeProtected(
      requirePermission('Sales', 'edit'),
      createSale,
      {
        body: { custno: 'C0001', empno: '00005', salesdate: '2026-10-15', lines: [{ prodcode: 'P0001', quantity: 1 }] },
        user: { email: 'viewer@hope.inc', role: 'employee', rights: ['sales.access'] }
      }
    );
    expect(forbiddenCreate.statusCode).toBe(403);

    expect(app).toBeDefined();
    expect(salesRoutes).toBeDefined();
    expect(getSaleByTransno).toBeTypeOf('function');
  });
});
