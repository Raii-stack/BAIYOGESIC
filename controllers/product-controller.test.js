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
  listProducts,
  getPriceHistory,
  addPriceHistory,
  createProduct,
  archiveProduct,
  restoreProduct,
} = require('./product-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: { email: 'admin@hope.inc', sub: 'user-1' }, query: {}, params: {}, body: {}, ...extra },
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

describe('controllers/product-controller ([S2-DEV-03a])', () => {
  test.each([
    [{ sortBy: 'stock' }, 'sortBy must be productCode, description, or unitPrice'],
    [{ sortOrder: 'up' }, 'sortOrder must be asc or desc'],
    [{ unit: 'pallet' }, 'Invalid unit filter'],
    [{ status: 'deleted' }, 'Invalid status filter'],
  ])('listProducts validates query filter %o', async (query, expectedMessage) => {
    const { error } = await invoke(listProducts, { query });
    expect(error).toMatchObject({ statusCode: 400, message: expectedMessage });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('createProduct rejects prodcode longer than 6 chars and duplicate active description (409)', async () => {
    const badCode = await invoke(createProduct, {
      body: { prodcode: 'PX00001', description: 'Analgesic', unit: 'pc', unitprice: 12 },
    });
    expect(badCode.error).toMatchObject({ statusCode: 400, details: { prodcode: 'Product code must be 6 characters or fewer' } });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('MAX(')) return { rows: [{ next_number: 5 }] };
      if (sql.includes('lower(trim(description))')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });
    const dup = await invoke(createProduct, {
      body: { description: 'Analgesic', unit: 'pc', unitprice: 12 },
    });
    expect(dup.error).toMatchObject({ statusCode: 409, message: 'A product with that description already exists' });
  });

  test('archiveProduct returns 409 when active salesdetail rows exist or DB trigger raises P0001', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ prodcode: 'PX0001' }] };
      if (sql.includes('FROM public.salesdetail')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const preflight = await invoke(archiveProduct, { params: { prodcode: 'PX0001' } });
    expect(preflight.error).toMatchObject({
      statusCode: 409,
      message: 'Cannot archive product while active sales records exist.',
    });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ prodcode: 'PX0001' }] };
      if (sql.includes('FROM public.salesdetail')) return { rows: [] };
      if (sql.includes('UPDATE public.product SET is_deleted = true')) {
        const err = new Error('active related record(s) still exist');
        err.code = 'P0001';
        throw err;
      }
      return { rows: [] };
    });

    const triggerErr = await invoke(archiveProduct, { params: { prodcode: 'PX0001' } });
    expect(triggerErr.error).toMatchObject({
      statusCode: 409,
      message: 'Cannot archive product while active sales records exist.',
    });
  });

  test('archiveProduct and restoreProduct cascade is_deleted across product and pricehist', async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ prodcode: 'PX0001' }] };
      if (sql.includes('FROM public.salesdetail')) return { rows: [] };
      if (sql.includes('UPDATE public.product SET is_deleted = true')) {
        return { rows: [{ prodcode: 'PX0001', description: 'Pain Relief', unit: 'pc', is_deleted: true, stamp: 'DEL' }] };
      }
      if (sql.includes('UPDATE public.product SET is_deleted = false')) {
        return { rows: [{ prodcode: 'PX0001', description: 'Pain Relief', unit: 'pc', is_deleted: false, stamp: 'RES' }] };
      }
      return { rows: [] };
    });

    const archived = await invoke(archiveProduct, { params: { prodcode: 'PX0001' } });
    expect(archived.statusCode).toBe(200);
    expect(archived.body.data.product.is_deleted).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => sql.includes('UPDATE public.pricehist SET is_deleted = true'))).toBe(true);

    client.query.mockClear();
    const restored = await invoke(restoreProduct, { params: { prodcode: 'PX0001' } });
    expect(restored.statusCode).toBe(200);
    expect(restored.body.data.product.is_deleted).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => sql.includes('UPDATE public.pricehist SET is_deleted = false'))).toBe(true);
  });

  test('getPriceHistory returns 404 for unknown product and filters by archived status otherwise', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const missing = await invoke(getPriceHistory, { params: { prodcode: 'NOPE' } });
    expect(missing.error).toMatchObject({ statusCode: 404, message: 'Product not found' });

    pool.query
      .mockResolvedValueOnce({ rows: [{ is_deleted: false }] })
      .mockResolvedValueOnce({ rows: [{ prodcode: 'PX0001', effdate: '2026-11-01', unitprice: '15.00', price: '15.00' }] });
    const found = await invoke(getPriceHistory, { params: { prodcode: 'PX0001' } });
    expect(found.statusCode).toBe(200);
    expect(found.body.data.prices).toHaveLength(1);
    expect(found.body.data.priceHistory).toEqual(found.body.data.prices);
  });

  test('addPriceHistory validates price/date boundaries and writes PRICE_UPDATE audit log', async () => {
    expect((await invoke(addPriceHistory, { params: { prodcode: 'PX0001' }, body: { price: 0, effdate: '2099-01-01' } })).error)
      .toMatchObject({ statusCode: 400, message: 'price must be a positive number' });
    expect((await invoke(addPriceHistory, { params: { prodcode: 'PX0001' }, body: { price: 10, effdate: '2020-01-01' } })).error)
      .toMatchObject({ statusCode: 400, message: 'Effective date cannot be in the past' });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM public.product WHERE prodcode')) return { rows: [{ prodcode: 'PX0001', is_deleted: false }] };
      if (sql.includes('SELECT 1 FROM public.pricehist')) return { rows: [] };
      if (sql.includes('SELECT unitprice, effdate::text')) return { rows: [{ unitprice: 18, effdate: '2026-10-01' }] };
      if (sql.includes('INSERT INTO public.pricehist')) return { rows: [{ prodcode: 'PX0001', effdate: '2099-01-01', unitprice: 22.5, is_deleted: false, stamp: 'ADD' }] };
      return { rows: [] };
    });

    const created = await invoke(addPriceHistory, { params: { prodcode: 'PX0001' }, body: { price: 22.5, effdate: '2099-01-01' } });
    expect(created.statusCode).toBe(201);
    expect(created.body.data.price.unitprice).toBe(22.5);
    const auditCall = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO public.audit_log'));
    expect(auditCall[1][1]).toContain('"price":18');
    expect(auditCall[1][2]).toContain('"event":"PRICE_UPDATE"');
  });
});
