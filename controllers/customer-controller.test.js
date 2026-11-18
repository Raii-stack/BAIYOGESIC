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
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
} = require('./customer-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: { email: 'admin@hope.inc' }, query: {}, params: {}, body: {}, ...extra },
    res,
    (err) => { error = err; },
  );
  return { statusCode, body, error };
}

beforeEach(() => {
  client.query.mockReset();
  client.release.mockReset();
  pool.query.mockReset();
  pool.connect.mockReset().mockResolvedValue(client);
});

describe('controllers/customer-controller ([S2-DEV-02a])', () => {
  test.each([
    [{ sortBy: 'email' }, 'sortBy must be customerId or customer'],
    [{ sortOrder: 'random' }, 'sortOrder must be asc or desc'],
    [{ payterm: '90D' }, 'payterm must be COD, 30D, 45D, or 60D'],
    [{ status: 'pending' }, 'status must be all, active, or archived'],
  ])('listCustomers rejects invalid query %o', async (query, expectedMessage) => {
    const { error } = await invoke(listCustomers, { query });
    expect(error).toMatchObject({ statusCode: 400, message: expectedMessage });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('listCustomers applies filters and falls back to count query on empty trailing page', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 12 }] });

    const { statusCode, body, error } = await invoke(listCustomers, {
      query: { page: '2', limit: '10', search: 'Acme', payterm: '60d', status: 'active', sortBy: 'customerId', sortOrder: 'desc' },
    });

    expect(error).toBeUndefined();
    expect(statusCode).toBe(200);
    expect(body.data.customers).toEqual([]);
    expect(body.data.pagination).toEqual({ page: 2, limit: 10, total: 12, totalPages: 2 });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toContain('ORDER BY custno DESC');
    expect(pool.query.mock.calls[0][1]).toEqual(['%Acme%', '60D', false, 10, 10]);
  });

  test('createCustomer normalizes aliases, whitespace, and payment terms', async () => {
    const inserted = { custno: 'C0011', custname: 'Acme Traders', address: '123 Market Rd', payterm: '30D', is_deleted: false, stamp: 'ADD' };
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM public.customer') && sql.includes('MAX(')) return { rows: [{ next_number: 11 }] };
      if (sql.includes('lower(trim(custname))')) return { rows: [] };
      if (sql.includes('INSERT INTO public.customer')) return { rows: [inserted] };
      return { rows: [] };
    });

    const { statusCode, body, error } = await invoke(createCustomer, {
      body: { customerName: '  Acme\tTraders ', address: '123\n  Market   Rd', paymentTerm: ' 30d ' },
    });

    expect(error).toBeUndefined();
    expect(statusCode).toBe(201);
    expect(body.data.customer).toEqual(inserted);
    const insertCall = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO public.customer'));
    expect(insertCall[1]).toEqual(['C0011', 'Acme Traders', '123 Market Rd', '30D']);
  });

  test('createCustomer rejects oversized fields and invalid payment terms with 400 details', async () => {
    const tooLong = await invoke(createCustomer, {
      body: { custname: 'A'.repeat(21), address: 'B'.repeat(51), payterm: '15D' },
    });
    expect(tooLong.error).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      details: {
        custname: 'Customer Name must be 20 characters or fewer',
        address: 'Address must be 50 characters or fewer',
        payterm: 'Payment term must be one of: 30D, 45D, 60D, COD',
      },
    });

    const badId = await invoke(createCustomer, {
      body: { custno: 'C00001', custname: 'Acme', address: 'Manila', payterm: 'COD' },
    });
    expect(badId.error).toMatchObject({ statusCode: 400, details: { custno: 'Customer ID must be 5 characters or fewer' } });
  });

  test('createCustomer returns 409 on case-insensitive duplicate name and rolls back transaction', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('MAX(')) return { rows: [{ next_number: 2 }] };
      if (sql.includes('lower(trim(custname))')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const { error } = await invoke(createCustomer, {
      body: { custname: 'acme', address: '123 Market', payterm: 'COD' },
    });

    expect(error).toMatchObject({ statusCode: 409, message: 'A customer with that name already exists' });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  test('updateCustomer returns 404 when customer is missing or archived', async () => {
    client.query.mockResolvedValue({ rows: [] });

    const { error } = await invoke(updateCustomer, {
      params: { custno: 'C9999' },
      body: { custname: 'Updated Co', address: 'Suite 1', payterm: '45D' },
    });

    expect(error).toMatchObject({ statusCode: 404, message: 'Customer not found' });
  });

  test('deleteCustomer returns 409 when active sales exist or DB trigger raises P0001', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ custno: 'C0001' }] };
      if (sql.includes('FROM public.sales')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const preflight = await invoke(deleteCustomer, { params: { custno: 'C0001' } });
    expect(preflight.error).toMatchObject({
      statusCode: 409,
      message: 'Cannot archive customer while active sales records exist.',
    });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ custno: 'C0001' }] };
      if (sql.includes('FROM public.sales')) return { rows: [] };
      if (sql.includes('SET is_deleted = true')) {
        const err = new Error('Cannot delete customer row: 2 active related record(s) still exist.');
        err.code = 'P0001';
        throw err;
      }
      return { rows: [] };
    });

    const triggerConflict = await invoke(deleteCustomer, { params: { custno: 'C0001' } });
    expect(triggerConflict.error).toMatchObject({
      statusCode: 409,
      message: 'Cannot archive customer while active sales records exist.',
    });
  });

  test('restoreCustomer clears soft delete for archived customers and returns 404 otherwise', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('SET is_deleted = false')) return { rows: [{ custno: 'C0001', is_deleted: false }] };
      return { rows: [] };
    });

    const ok = await invoke(restoreCustomer, { params: { custno: 'C0001' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.data.customer.is_deleted).toBe(false);

    client.query.mockResolvedValue({ rows: [] });
    const missing = await invoke(restoreCustomer, { params: { custno: 'C0001' } });
    expect(missing.error).toMatchObject({ statusCode: 404, message: 'Customer not found' });
  });
});
