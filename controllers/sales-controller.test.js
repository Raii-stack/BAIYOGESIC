// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const client = { query: vi.fn(), release: vi.fn() };
const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const {
  listSales,
  lookupProductPrice,
  recordPayment,
  restoreSale,
} = require('./sales-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: { email: 'admin@hope.inc', role: 'admin' }, query: {}, params: {}, body: {}, ...extra },
    res,
    (err) => { error = err; },
  );
  return { statusCode, body, error };
}

describe('controllers/sales-controller ([S4-DBA-04 & S4-DBA-05])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  test('listSales validates status filter and maps inactive alias to archived', async () => {
    expect((await invoke(listSales, { query: { status: 'voided' } })).error)
      .toMatchObject({ statusCode: 400, message: 'Invalid status filter' });

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });

    const res = await invoke(listSales, { query: { status: 'inactive', custno: 'C1001' } });
    expect(res.error).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([true, 'C1001', 25, 0]);
  });

  test('lookupProductPrice validates product code, salesdate format, and returns effective price or 404', async () => {
    expect((await invoke(lookupProductPrice, { params: {} })).error).toMatchObject({ statusCode: 400 });
    expect((await invoke(lookupProductPrice, { params: { prodcode: 'P1001' }, query: { salesdate: '2026/01/01' } })).error)
      .toMatchObject({ statusCode: 400 });

    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await invoke(lookupProductPrice, { params: { prodcode: 'P1001' }, query: { salesdate: '2020-01-01' } })).error)
      .toMatchObject({ statusCode: 404 });

    pool.query.mockResolvedValueOnce({ rows: [{ prodcode: 'P1001', effdate: '2026-01-15', unitprice: '20.00' }] });
    const found = await invoke(lookupProductPrice, { params: { prodcode: 'P1001' }, query: { salesdate: '2026-02-01' } });
    expect(found.statusCode).toBe(200);
    expect(found.body.data.unitprice).toBe(20);
  });

  test('recordPayment rejects invalid methods and overpayments exceeding remaining balance', async () => {
    expect((await invoke(recordPayment, {
      params: { transno: 'TR1001' },
      body: { amount: 50, payment_method: 'Crypto' },
    })).error).toMatchObject({ statusCode: 400, message: 'Payment method is invalid' });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM public.sales s')) {
        return { rows: [{ transno: 'TR1001', salesdate: '2026-02-15', custno: 'C1001', empno: '00005', is_deleted: false }] };
      }
      if (sql.includes('FROM public.salesdetail sd')) {
        return { rows: [{ transno: 'TR1001', prodcode: 'P1001', quantity: '2', unitprice: '25.00', is_deleted: false }] };
      }
      if (sql.includes('FROM public.payment')) {
        return { rows: [{ orno: 'OR1001', paydate: '2026-02-16', amount: '30.00', payment_method: 'Cash', transno: 'TR1001', is_deleted: false }] };
      }
      return { rows: [] };
    });

    const overpay = await invoke(recordPayment, {
      params: { transno: 'TR1001' },
      body: { amount: 25, payment_method: 'Cash', paydate: '2026-02-17' },
    });
    expect(overpay.error).toMatchObject({
      statusCode: 400,
      message: 'Payment cannot exceed the remaining balance.',
    });
  });

  test('restoreSale restores sales header and line items or returns 404 when missing', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT transno, is_deleted FROM public.sales WHERE transno')) return { rows: [] };
      return { rows: [] };
    });
    expect((await invoke(restoreSale, { params: { transno: 'TR9999' } })).error).toMatchObject({ statusCode: 404 });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT transno, is_deleted FROM public.sales WHERE transno')) {
        return { rows: [{ transno: 'TR1001', is_deleted: true }] };
      }
      if (sql.includes('FROM public.sales s')) {
        return { rows: [{ transno: 'TR1001', salesdate: '2026-02-15', custno: 'C1001', empno: '00005', is_deleted: false }] };
      }
      return { rows: [] };
    });

    const restored = await invoke(restoreSale, { params: { transno: 'TR1001' } });
    expect(restored.error).toBeUndefined();
    expect(restored.statusCode).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE public.sales SET is_deleted = false WHERE transno = $1 AND is_deleted = true',
      ['TR1001']
    );
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE public.salesdetail SET is_deleted = false WHERE transno = $1 AND is_deleted = true',
      ['TR1001']
    );
  });
});
