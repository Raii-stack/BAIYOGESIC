import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const mockPool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient)
};

// Ensure both CJS and ESM see the mocked db module
require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const {
  listProducts,
  getPriceHistory,
  addPriceHistory,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct
} = require('../../controllers/product-controller');
const {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer
} = require('../../controllers/customer-controller');
const { lookupProductPrice } = require('../../controllers/sales-controller');
const { requirePermission } = require('../../middleware/permissions');
const productRoutes = require('../../routes/product-routes');
const customerRoutes = require('../../routes/customer-routes');

describe('Product edit response', () => {
  test.each([['12.50', 25], ['25.00', 25], [null, 25]])('includes the saved price and date when the previous price is %s', async (previousPrice, unitprice) => {
    mockClient.query.mockReset();
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('UPDATE public.product')) return { rows: [{ prodcode: 'PX0001', description: 'Updated product', unit: 'ea', is_deleted: false, stamp: 'EDIT admin' }] };
      if (sql.includes('SELECT unitprice')) return { rows: previousPrice === null ? [] : [{ unitprice: previousPrice, effdate: '2026-10-01' }] };
      if (sql.includes('INSERT INTO public.pricehist')) {
        expect(sql).toContain('RETURNING unitprice, effdate::text AS effdate');
        return { rows: [{ unitprice: String(params[1]), effdate: '2026-11-02' }] };
      }
      return { rows: [] };
    });
    const res = { json: vi.fn() };
    await updateProduct({ params: { prodcode: 'PX0001' }, body: { description: 'Updated product', unit: 'ea', unitprice }, user: { email: 'admin@hope.inc' } }, res, (error) => { throw error; });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { product: {
      prodcode: 'PX0001', description: 'Updated product', unit: 'ea', is_deleted: false, stamp: 'EDIT admin',
      unitprice: '25.00' === previousPrice ? previousPrice : '25',
      effdate: '25.00' === previousPrice ? '2026-10-01' : '2026-11-02',
    } } });
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
});

describe('[S2-DEV-07a] Price History API & Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT is_deleted FROM public.product WHERE prodcode = $1')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ is_deleted: false }] };
      }
      if (typeof sql === 'string' && sql.includes('ORDER BY effdate DESC')) {
        return {
          rows: [
            { prodcode: 'P1001', effdate: '2026-11-01', unitprice: '150.00', price: '150.00', is_deleted: false, stamp: 'ADD admin' },
            { prodcode: 'P1001', effdate: '2026-10-01', unitprice: '140.00', price: '140.00', is_deleted: false, stamp: 'ADD admin' },
            { prodcode: 'P1001', effdate: '2026-09-01', unitprice: '120.00', price: '120.00', is_deleted: false, stamp: 'ADD admin' }
          ]
        };
      }
      return { rows: [] };
    });

    mockClient.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT prodcode, is_deleted FROM public.product WHERE prodcode = $1 FOR UPDATE')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ prodcode: 'P1001', is_deleted: false }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.pricehist WHERE prodcode = $1 AND effdate = $2::date')) {
        if (params?.[1] === '2099-05-01') return { rows: [{ 1: 1 }] }; // duplicate
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT unitprice') && sql.includes('FROM public.pricehist')) {
        return { rows: [{ unitprice: '140.00', effdate: '2026-10-01' }] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO public.pricehist')) {
        return {
          rows: [{
            effdate: params?.[0] || '2099-01-01',
            prodcode: params?.[1] || 'P1001',
            unitprice: params?.[2] || '160.00',
            is_deleted: false,
            stamp: 'ADD test@hope.inc'
          }]
        };
      }
      return { rows: [] };
    });
  });

  describe('GET /api/products/:prodcode/price-history', () => {
    test('returns chronological history array ordered by effdate DESC', async () => {
      const req = { params: { prodcode: 'P1001' } };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await getPriceHistory(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.prodcode).toBe('P1001');
      expect(Array.isArray(responseBody.data.priceHistory)).toBe(true);
      expect(responseBody.data.priceHistory).toHaveLength(3);
      expect(responseBody.data.priceHistory[0].effdate).toBe('2026-11-01');
      expect(responseBody.data.priceHistory[1].effdate).toBe('2026-10-01');
      expect(responseBody.data.priceHistory[2].effdate).toBe('2026-09-01');
      expect(responseBody.data.prices).toEqual(responseBody.data.priceHistory);

      const historyCall = mockPool.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('ORDER BY effdate DESC')
      );
      expect(historyCall).toBeDefined();
    });

    test('returns 404 when product is not found', async () => {
      const req = { params: { prodcode: 'NONEXISTENT' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await getPriceHistory(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/product not found/i);
    });
  });

  describe('POST /api/products/:prodcode/price-history', () => {
    test('inserts a price tier and writes a corresponding audit log row in audit_log', async () => {
      const futureDate = '2099-01-01';
      const req = {
        params: { prodcode: 'P1001' },
        body: { effdate: futureDate, price: 160.00 },
        user: { sub: 'user-uuid-999', email: 'test@hope.inc', role: 'admin' }
      };

      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await addPriceHistory(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.price.price).toBe(160);
      expect(responseBody.data.price.effdate).toBe(futureDate);

      // Keep the database action compatible while preserving the price event in its snapshot.
      const auditCall = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log')
      );
      expect(auditCall).toBeDefined();
      const [sql, params] = auditCall;
      expect(sql).toContain("'EDIT'");
      expect(params[0]).toBe('P1001'); // record_key
      const oldVals = JSON.parse(params[1]);
      const newVals = JSON.parse(params[2]);
      expect(newVals.event).toBe('PRICE_UPDATE');
      expect(oldVals.price).toBe(140);
      expect(newVals.price).toBe(160);
      expect(newVals.effdate).toBe(futureDate);
      expect(params[3]).toBe('user-uuid-999'); // actor user ID
    });

    test('duplicate effective dates on the same product return HTTP 400', async () => {
      const date = '2099-05-01';
      const req = {
        params: { prodcode: 'P1001' },
        body: { effdate: date, price: 175.00 },
        user: { sub: 'user-1', email: 'admin@hope.inc' }
      };

      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await addPriceHistory(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/effective date already exists/i);
    });

    test('rejects non-positive price with HTTP 400', async () => {
      const req = {
        params: { prodcode: 'P1001' },
        body: { effdate: '2099-01-01', price: -5.00 },
        user: { sub: 'user-1' }
      };

      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await addPriceHistory(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/positive number/i);
    });

    test('rejects past effective date with HTTP 400', async () => {
      const req = {
        params: { prodcode: 'P1001' },
        body: { effdate: '2000-01-01', price: 99.00 },
        user: { sub: 'user-1' }
      };

      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await addPriceHistory(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/past/i);
    });
  });

  describe('Route configurations', () => {
    test('routes register /:prodcode/price-history and /:prodcode/prices', () => {
      const routes = productRoutes.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      expect(routes.some((r) => r.path === '/:prodcode/price-history' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/:prodcode/price-history' && r.methods.includes('post'))).toBe(true);
      expect(routes.some((r) => r.path === '/:prodcode/prices' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/:prodcode/prices' && r.methods.includes('post'))).toBe(true);
    });
  });
});

describe('[S2-DEV-03a] Customer & Product Soft Delete Integrity & Dependency Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockClient.query.mockImplementation(async (sql, params) => {
      // Product queries
      if (typeof sql === 'string' && sql.includes('SELECT prodcode FROM public.product WHERE prodcode = $1 AND is_deleted = false FOR UPDATE')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ prodcode: params?.[0] || 'P1001' }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT prodcode FROM public.product WHERE prodcode = $1 AND is_deleted = true FOR UPDATE')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ prodcode: params?.[0] || 'P1001' }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.salesdetail WHERE prodcode = $1 AND is_deleted = false')) {
        if (params?.[0] === 'P-WITH-SALES') return { rows: [{ 1: 1 }] };
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.product SET is_deleted = true')) {
        if (params?.[0] === 'P-TRIGGER-FAIL') {
          const err = new Error('Cannot delete product row: 1 active related record(s) still exist.');
          err.code = 'P0001';
          throw err;
        }
        return {
          rows: [{
            prodcode: params?.[0] || 'P1001',
            description: 'Sample Product',
            unit: 'pc',
            is_deleted: true,
            stamp: 'MOD admin'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.product SET is_deleted = false')) {
        return {
          rows: [{
            prodcode: params?.[0] || 'P1001',
            description: 'Sample Product',
            unit: 'pc',
            is_deleted: false,
            stamp: 'MOD admin'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.pricehist SET is_deleted = true')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.pricehist SET is_deleted = false')) {
        return { rows: [] };
      }

      // Customer queries
      if (typeof sql === 'string' && sql.includes('SELECT custno FROM public.customer WHERE custno = $1 AND is_deleted = false FOR UPDATE')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ custno: params?.[0] || 'C1001' }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.sales WHERE custno = $1 AND is_deleted = false')) {
        if (params?.[0] === 'C-WITH-SALES') return { rows: [{ 1: 1 }] };
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.customer') && sql.includes('SET is_deleted = true')) {
        if (params?.[0] === 'C-TRIGGER-FAIL') {
          const err = new Error('Cannot delete customer row: 1 active related record(s) still exist.');
          err.code = 'P0001';
          throw err;
        }
        return {
          rows: [{
            custno: params?.[0] || 'C1001',
            custname: 'Acme Corp',
            address: '123 Main St',
            payterm: '30D',
            is_deleted: true,
            stamp: 'MOD admin'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.customer') && sql.includes('SET is_deleted = false')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return {
          rows: [{
            custno: params?.[0] || 'C1001',
            custname: 'Acme Corp',
            address: '123 Main St',
            payterm: '30D',
            is_deleted: false,
            stamp: 'MOD admin'
          }]
        };
      }

      return { rows: [] };
    });
  });

  describe('Product Soft Delete & Dependencies (archiveProduct)', () => {
    test('attempting to archive a product with active sales transaction lines returns HTTP 409 Conflict', async () => {
      const req = {
        params: { prodcode: 'P-WITH-SALES' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive product while active sales records exist.');
    });

    test('catches PostgreSQL P0001 active related records trigger exception and returns HTTP 409 Conflict', async () => {
      const req = {
        params: { prodcode: 'P-TRIGGER-FAIL' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive product while active sales records exist.');
    });

    test('successfully archives an unreferenced product setting is_deleted = true without destroying data', async () => {
      const req = {
        params: { prodcode: 'P1001' },
        user: { email: 'admin@hope.inc' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await archiveProduct(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.product.prodcode).toBe('P1001');
      expect(responseBody.data.product.is_deleted).toBe(true);

      // Verify price history soft delete was called
      const pricehistArchive = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('UPDATE public.pricehist SET is_deleted = true')
      );
      expect(pricehistArchive).toBeDefined();
    });

    test('returns 404 when archiving a nonexistent or already archived product', async () => {
      const req = {
        params: { prodcode: 'NONEXISTENT' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/product not found/i);
    });

    test('returns 400 when product code is empty', async () => {
      const req = {
        params: { prodcode: '   ' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/product code is required/i);
    });
  });

  describe('Product Restore (restoreProduct)', () => {
    test('successfully restores a soft-deleted product and price history to active status', async () => {
      const req = {
        params: { prodcode: 'P1001' },
        user: { email: 'admin@hope.inc' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await restoreProduct(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.product.prodcode).toBe('P1001');
      expect(responseBody.data.product.is_deleted).toBe(false);

      // Verify price history restore was called
      const pricehistRestore = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('UPDATE public.pricehist SET is_deleted = false')
      );
      expect(pricehistRestore).toBeDefined();
    });

    test('returns 404 when restoring a product that is not archived or does not exist', async () => {
      const req = {
        params: { prodcode: 'NONEXISTENT' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await restoreProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/product not found/i);
    });

    test('returns 400 when product code is empty on restore', async () => {
      const req = {
        params: { prodcode: '' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await restoreProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/product code is required/i);
    });
  });

  describe('Customer Soft Delete & Dependencies (deleteCustomer)', () => {
    test('attempting to archive a customer with active sales records returns HTTP 409 Conflict', async () => {
      const req = {
        params: { custno: 'C-WITH-SALES' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await deleteCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive customer while active sales records exist.');
    });

    test('catches PostgreSQL P0001 customer trigger exception and returns HTTP 409 Conflict', async () => {
      const req = {
        params: { custno: 'C-TRIGGER-FAIL' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await deleteCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive customer while active sales records exist.');
    });

    test('successfully archives an unreferenced customer setting is_deleted = true without destroying data', async () => {
      const req = {
        params: { custno: 'C1001' },
        user: { email: 'admin@hope.inc' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await deleteCustomer(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.customer.custno).toBe('C1001');
      expect(responseBody.data.customer.is_deleted).toBe(true);
    });

    test('returns 404 when archiving a nonexistent customer', async () => {
      const req = {
        params: { custno: 'NONEXISTENT' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await deleteCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/customer not found/i);
    });

    test('returns 400 when custno is empty on delete', async () => {
      const req = {
        params: { custno: '   ' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await deleteCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/custno is required/i);
    });
  });

  describe('Customer Restore (restoreCustomer)', () => {
    test('successfully restores a soft-deleted customer to active status', async () => {
      const req = {
        params: { custno: 'C1001' },
        user: { email: 'admin@hope.inc' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await restoreCustomer(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.customer.custno).toBe('C1001');
      expect(responseBody.data.customer.is_deleted).toBe(false);
    });

    test('returns 404 when restoring a customer that is not archived or does not exist', async () => {
      const req = {
        params: { custno: 'NONEXISTENT' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await restoreCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/customer not found/i);
    });

    test('returns 400 when custno is empty on restore', async () => {
      const req = {
        params: { custno: '' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await restoreCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/custno is required/i);
    });
  });

  describe('Route Configurations & Permissions', () => {
    test('product routes register DELETE /:prodcode and POST /:prodcode/restore', () => {
      const routes = productRoutes.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      expect(routes.some((r) => r.path === '/:prodcode' && r.methods.includes('delete'))).toBe(true);
      expect(routes.some((r) => r.path === '/:prodcode/restore' && r.methods.includes('post'))).toBe(true);
    });

    test('customer routes register DELETE /:custno and POST /:custno/restore', () => {
      const routes = customerRoutes.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      expect(routes.some((r) => r.path === '/:custno' && r.methods.includes('delete'))).toBe(true);
      expect(routes.some((r) => r.path === '/:custno/restore' && r.methods.includes('post'))).toBe(true);
    });
  });
});

describe('[S2-TST-01] Customer Pagination, Filtering, Search, and Permission Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  const sampleCustomer = (i, overrides = {}) => ({
    custno: `C${String(i).padStart(4, '0')}`,
    custname: `Customer ${i}`,
    address: `${i} Industry Way`,
    payterm: '30D',
    is_deleted: false,
    stamp: 'ADD admin',
    _total: 45,
    ...overrides
  });

  describe('GET /api/customers - Pagination', () => {
    test('returns default pagination (page=1, limit=25) with customer rows and metadata', async () => {
      mockPool.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('FROM public.customer')) {
          expect(params).toEqual([25, 0]); // limit 25, offset 0
          const rows = Array.from({ length: 25 }, (_, idx) => sampleCustomer(idx + 1));
          return { rows };
        }
        return { rows: [] };
      });

      const req = { query: {} };
      let responseBody = null;
      let statusCode = 200;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.customers).toHaveLength(25);
      expect(responseBody.data.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 45,
        totalPages: 2
      });
      // Ensure internal _total is stripped from public entity
      expect(responseBody.data.customers[0]._total).toBeUndefined();
    });

    test('applies custom page and limit with accurate SQL limit and offset calculations', async () => {
      mockPool.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('FROM public.customer')) {
          expect(params).toEqual([10, 20]); // page 3, limit 10 => limit 10, offset 20
          const rows = Array.from({ length: 10 }, (_, idx) => sampleCustomer(idx + 21));
          return { rows };
        }
        return { rows: [] };
      });

      const req = { query: { page: '3', limit: '10' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.customers).toHaveLength(10);
      expect(responseBody.data.customers[0].custno).toBe('C0021');
      expect(responseBody.data.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 45,
        totalPages: 5
      });
    });

    test('executes fallback count query when requesting an offset beyond total records', async () => {
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('_total')) {
          return { rows: [] }; // Empty page
        }
        if (typeof sql === 'string' && sql.includes('SELECT count(*)::integer AS total')) {
          return { rows: [{ total: 18 }] };
        }
        return { rows: [] };
      });

      const req = { query: { page: '5', limit: '10' } }; // offset 40 > total 18
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.customers).toEqual([]);
      expect(responseBody.data.pagination).toEqual({
        page: 5,
        limit: 10,
        total: 18,
        totalPages: 2
      });
    });
  });

  describe('GET /api/customers - Search & Filter Queries', () => {
    test('searches customer records by keyword across custno, custname, and address with ILIKE', async () => {
      let executedSql = '';
      let executedParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return {
          rows: [
            sampleCustomer(1, { custno: 'C0001', custname: 'Apex Logistics', address: '100 North Blvd', _total: 1 })
          ]
        };
      });

      const req = { query: { search: 'Apex' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(executedSql).toContain('(custno ILIKE $1 OR custname ILIKE $1 OR address ILIKE $1)');
      expect(executedParams).toEqual(['%Apex%', 25, 0]);
      expect(responseBody.data.customers).toHaveLength(1);
      expect(responseBody.data.customers[0].custname).toBe('Apex Logistics');
    });

    test('returns empty customer array and 0 total pages when search yields no matches', async () => {
      mockPool.query.mockImplementation(async () => ({ rows: [] }));

      const req = { query: { search: 'NoSuchCustomerFound' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.customers).toEqual([]);
      expect(responseBody.data.pagination.total).toBe(0);
      expect(responseBody.data.pagination.totalPages).toBe(0);
    });

    test('filters customers by payment term (payterm)', async () => {
      let executedSql = '';
      let executedParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return {
          rows: [
            sampleCustomer(1, { payterm: 'COD', _total: 4 }),
            sampleCustomer(2, { payterm: 'COD', _total: 4 })
          ]
        };
      });

      const req = { query: { payterm: 'COD' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listCustomers(req, res, (err) => { if (err) throw err; });

      expect(executedSql).toContain('payterm = $1');
      expect(executedParams).toEqual(['COD', 25, 0]);
      expect(responseBody.data.customers.every((c) => c.payterm === 'COD')).toBe(true);
    });

    test('filters customers by status: active, archived, or all', async () => {
      let lastParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        lastParams = params;
        return { rows: [] };
      });

      const res = { json: vi.fn() };

      // status = active -> is_deleted = false
      await listCustomers({ query: { status: 'active' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([false, 25, 0]);

      // status = archived -> is_deleted = true
      await listCustomers({ query: { status: 'archived' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([true, 25, 0]);

      // status = all -> no is_deleted filter
      await listCustomers({ query: { status: 'all' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([25, 0]);
    });

    test('supports sorting by customer name (with secondary custno sort) and customerId', async () => {
      let capturedSql = '';
      mockPool.query.mockImplementation(async (sql) => {
        capturedSql = sql;
        return { rows: [] };
      });
      const res = { json: vi.fn() };

      // sortBy = customer, sortOrder = asc
      await listCustomers({ query: { sortBy: 'customer', sortOrder: 'asc' } }, res, (err) => { if (err) throw err; });
      expect(capturedSql).toContain('ORDER BY custname ASC, custno ASC');

      // sortBy = customerId, sortOrder = desc
      await listCustomers({ query: { sortBy: 'customerId', sortOrder: 'desc' } }, res, (err) => { if (err) throw err; });
      expect(capturedSql).toContain('ORDER BY custno DESC');
    });
  });

  describe('GET /api/customers - Validation Errors (HTTP 400 Bad Request)', () => {
    test.each([
      ['invalid sortBy parameter', { sortBy: 'phone' }, /sortBy must be customerId or customer/i],
      ['invalid sortOrder parameter', { sortOrder: 'reverse' }, /sortOrder must be asc or desc/i],
      ['invalid payterm parameter', { payterm: '90D' }, /payterm must be COD, 30D, 45D, or 60D/i],
      ['invalid status parameter', { status: 'purged' }, /status must be all, active, or archived/i]
    ])('rejects %s with HTTP 400', async (_, query, errorPattern) => {
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await listCustomers({ query }, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(errorPattern);
    });
  });

  describe('Customer CRUD & Conflict Validation (201, 400, 409)', () => {
    test('createCustomer creates customer and returns 201 Created', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('MAX(substring(custno FROM 2)::integer)')) return { rows: [{ next_number: 10 }] };
        if (sql.includes('WHERE is_deleted = false AND lower(trim(custname))')) return { rows: [] }; // no duplicate
        if (sql.includes('INSERT INTO public.customer')) {
          return {
            rows: [{
              custno: 'C0010',
              custname: 'Global Ventures',
              address: '500 Corporate Ave',
              payterm: '30D',
              is_deleted: false,
              stamp: 'ADD admin'
            }]
          };
        }
        return { rows: [] };
      });

      const req = {
        body: { custname: 'Global Ventures', address: '500 Corporate Ave', payterm: '30D' },
        user: { email: 'admin@hope.inc' }
      };
      let statusCode = 200;
      let responseBody = null;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await createCustomer(req, res, (err) => { if (err) throw err; });

      expect(statusCode).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.customer.custno).toBe('C0010');
      expect(responseBody.data.customer.custname).toBe('Global Ventures');
    });

    test('createCustomer rejects duplicate customer name with HTTP 409 Conflict', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('MAX(substring(custno FROM 2)::integer)')) return { rows: [{ next_number: 10 }] };
        if (sql.includes('lower(trim(custname))')) {
          return { rows: [{ 1: 1 }] }; // duplicate found
        }
        return { rows: [] };
      });

      const req = {
        body: { custname: 'Existing Customer', address: '123 Main St', payterm: '30D' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toMatch(/already exists/i);
    });

    test('createCustomer rejects missing required fields with HTTP 400 Bad Request', async () => {
      const req = {
        body: { custname: '', address: '', payterm: 'INVALID' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.details.custname).toBeDefined();
      expect(capturedError.details.address).toBeDefined();
      expect(capturedError.details.payterm).toBeDefined();
    });

    test('updateCustomer updates an existing customer and returns 200 OK', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('WHERE is_deleted = false AND custno <> $1')) return { rows: [] }; // no duplicate
        if (sql.includes('UPDATE public.customer')) {
          return {
            rows: [{
              custno: 'C0001',
              custname: 'Updated Enterprise',
              address: '777 Broadway',
              payterm: '45D',
              is_deleted: false,
              stamp: 'EDIT admin'
            }]
          };
        }
        return { rows: [] };
      });

      const req = {
        params: { custno: 'C0001' },
        body: { custname: 'Updated Enterprise', address: '777 Broadway', payterm: '45D' },
        user: { email: 'admin@hope.inc' }
      };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await updateCustomer(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.customer.custname).toBe('Updated Enterprise');
      expect(responseBody.data.customer.payterm).toBe('45D');
    });

    test('updateCustomer rejects duplicate customer name on another customer with HTTP 409 Conflict', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('custno <> $1') && sql.includes('lower(trim(custname))')) {
          return { rows: [{ 1: 1 }] }; // duplicate name exists on different customer
        }
        return { rows: [] };
      });

      const req = {
        params: { custno: 'C0001' },
        body: { custname: 'Duplicate Company', address: '123 St', payterm: '30D' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await updateCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toMatch(/already exists/i);
    });

    test('updateCustomer returns 404 when customer record does not exist', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('WHERE is_deleted = false AND custno <> $1')) return { rows: [] };
        if (sql.includes('UPDATE public.customer')) return { rows: [] };
        return { rows: [] };
      });

      const req = {
        params: { custno: 'NONEXISTENT' },
        body: { custname: 'Ghost Corp', address: 'Nowhere', payterm: 'COD' },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await updateCustomer(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/customer not found/i);
    });
  });

  describe('Customer RBAC & Permissions (HTTP 403 Forbidden)', () => {
    test('unauthorized employee without CRM view permission receives HTTP 403 Forbidden', () => {
      const middleware = requirePermission('CRM', 'view');
      const req = { user: { role: 'employee', rights: [] } };
      let statusCode = 200;
      let responseBody = null;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(statusCode).toBe(403);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('unauthorized employee without CRM edit permission receives HTTP 403 on mutate', () => {
      const middleware = requirePermission('CRM', 'edit');
      const req = { user: { role: 'employee', rights: ['customers.access'] } }; // only view right
      let statusCode = 200;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('employee with granular customers.add right is allowed to proceed', () => {
      const middleware = requirePermission('CRM', 'edit');
      const req = { user: { role: 'employee', rights: ['customers.add'] } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

describe('[S2-TST-02] Product Pagination, Search, Filtering, and Price History Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  const sampleProduct = (i, overrides = {}) => ({
    prodcode: `PX${String(i).padStart(4, '0')}`,
    description: `Product ${i}`,
    unit: 'pc',
    unitprice: '25.00',
    effdate: '2026-10-01',
    is_deleted: false,
    stamp: 'ADD admin',
    _total: 50,
    ...overrides
  });

  describe('GET /api/products - Pagination', () => {
    test('returns default pagination (page=1, limit=25) with product rows and active prices', async () => {
      mockPool.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('FROM public.product p')) {
          expect(params).toEqual([25, 0]);
          const rows = Array.from({ length: 25 }, (_, idx) => sampleProduct(idx + 1));
          return { rows };
        }
        return { rows: [] };
      });

      const req = { query: {} };
      let responseBody = null;
      let statusCode = 200;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.products).toHaveLength(25);
      expect(responseBody.data.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 50,
        totalPages: 2
      });
      expect(responseBody.data.products[0]._total).toBeUndefined();
    });

    test('applies custom page and limit with correct SQL parameters', async () => {
      mockPool.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('FROM public.product p')) {
          expect(params).toEqual([15, 30]); // page 3, limit 15 => offset 30
          const rows = Array.from({ length: 15 }, (_, idx) => sampleProduct(idx + 31));
          return { rows };
        }
        return { rows: [] };
      });

      const req = { query: { page: '3', limit: '15' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.products).toHaveLength(15);
      expect(responseBody.data.products[0].prodcode).toBe('PX0031');
      expect(responseBody.data.pagination).toEqual({
        page: 3,
        limit: 15,
        total: 50,
        totalPages: 4
      });
    });

    test('executes fallback count query when requesting an offset beyond total products', async () => {
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('count(*) OVER()::integer AS _total')) {
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT count(*)::integer AS total FROM public.product')) {
          return { rows: [{ total: 22 }] };
        }
        return { rows: [] };
      });

      const req = { query: { page: '4', limit: '10' } }; // offset 30 > 22
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.products).toEqual([]);
      expect(responseBody.data.pagination).toEqual({
        page: 4,
        limit: 10,
        total: 22,
        totalPages: 3
      });
    });
  });

  describe('GET /api/products - Search & Filter Queries', () => {
    test('searches products by keyword across prodcode and description with ILIKE', async () => {
      let executedSql = '';
      let executedParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return {
          rows: [sampleProduct(1, { prodcode: 'PX0001', description: 'Laser Pointer', _total: 1 })]
        };
      });

      const req = { query: { search: 'Laser' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(executedSql).toContain('(p.prodcode ILIKE $1 OR p.description ILIKE $1)');
      expect(executedParams).toEqual(['%Laser%', 25, 0]);
      expect(responseBody.data.products[0].description).toBe('Laser Pointer');
    });

    test('returns empty array when search matches no products', async () => {
      mockPool.query.mockImplementation(async () => ({ rows: [] }));

      const req = { query: { search: 'Unobtainable' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.products).toEqual([]);
      expect(responseBody.data.pagination.total).toBe(0);
    });

    test('filters products by unit type (unit: pc, ea, mtr, pkg, ltr)', async () => {
      let executedSql = '';
      let executedParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return { rows: [sampleProduct(1, { unit: 'pkg', _total: 1 })] };
      });

      const req = { query: { unit: 'pkg' } };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      expect(executedSql).toContain('p.unit = $1');
      expect(executedParams).toEqual(['pkg', 25, 0]);
      expect(responseBody.data.products[0].unit).toBe('pkg');
    });

    test('filters products by status: active, archived, or all', async () => {
      let lastParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        lastParams = params;
        return { rows: [] };
      });
      const res = { json: vi.fn() };

      await listProducts({ query: { status: 'active' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([false, 25, 0]);

      await listProducts({ query: { status: 'archived' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([true, 25, 0]);

      await listProducts({ query: { status: 'all' } }, res, (err) => { if (err) throw err; });
      expect(lastParams).toEqual([25, 0]);
    });

    test('supports sorting by productCode, description, and unitPrice', async () => {
      let capturedSql = '';
      mockPool.query.mockImplementation(async (sql) => {
        capturedSql = sql;
        return { rows: [] };
      });
      const res = { json: vi.fn() };

      await listProducts({ query: { sortBy: 'unitPrice', sortOrder: 'desc' } }, res, (err) => { if (err) throw err; });
      expect(capturedSql).toContain('ORDER BY price.unitprice DESC NULLS LAST, p.prodcode ASC');

      await listProducts({ query: { sortBy: 'productCode', sortOrder: 'asc' } }, res, (err) => { if (err) throw err; });
      expect(capturedSql).toContain('ORDER BY p.prodcode ASC');
    });

    test('resolves active price through LATERAL join and handles products without pricing', async () => {
      let executedSql = '';
      mockPool.query.mockImplementation(async (sql) => {
        executedSql = sql;
        return {
          rows: [
            sampleProduct(1, { unitprice: '19.99', effdate: '2026-10-01' }),
            sampleProduct(2, { unitprice: null, effdate: null }) // no pricehist entry
          ]
        };
      });

      const req = { query: {} };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await listProducts(req, res, (err) => { if (err) throw err; });

      // Verify the query contains lateral join restricting to Asia/Manila date
      expect(executedSql).toContain("ph.effdate <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date");
      expect(responseBody.data.products[0].unitprice).toBe('19.99');
      expect(responseBody.data.products[0].effdate).toBe('2026-10-01');
      expect(responseBody.data.products[1].unitprice).toBeNull();
      expect(responseBody.data.products[1].effdate).toBeNull();
    });
  });

  describe('GET /api/products - Validation Errors (HTTP 400 Bad Request)', () => {
    test.each([
      ['invalid sortBy parameter', { sortBy: 'cost' }, /sortBy must be productCode, description, or unitPrice/i],
      ['invalid sortOrder parameter', { sortOrder: 'sideways' }, /sortOrder must be asc or desc/i],
      ['invalid unit parameter', { unit: 'box' }, /Invalid unit filter/i],
      ['invalid status parameter', { status: 'deleted' }, /Invalid status filter/i]
    ])('rejects %s with HTTP 400', async (_, query, errorPattern) => {
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await listProducts({ query }, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(errorPattern);
    });
  });

  describe('Product CRUD & Conflict Validation (201, 400, 409)', () => {
    test('createProduct creates product and initial price history returning 201 Created', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('MAX(substring(prodcode FROM 3)::integer)')) return { rows: [{ next_number: 5 }] };
        if (sql.includes('WHERE is_deleted = false AND lower(trim(description))')) return { rows: [] };
        if (sql.includes('INSERT INTO public.product')) {
          return { rows: [{ prodcode: 'PX0005', description: 'Thermal Paper', unit: 'pkg', is_deleted: false, stamp: 'ADD admin' }] };
        }
        if (sql.includes('INSERT INTO public.pricehist')) {
          return { rows: [{ effdate: '2026-11-23', unitprice: '14.50' }] };
        }
        return { rows: [] };
      });

      const req = {
        body: { description: 'Thermal Paper', unit: 'pkg', unitprice: 14.50 },
        user: { email: 'admin@hope.inc' }
      };
      let statusCode = 200;
      let responseBody = null;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await createProduct(req, res, (err) => { if (err) throw err; });

      expect(statusCode).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.product.prodcode).toBe('PX0005');
      expect(responseBody.data.product.unitprice).toBe('14.50');
    });

    test('createProduct rejects duplicate product description with HTTP 409 Conflict', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('MAX(substring(prodcode FROM 3)::integer)')) return { rows: [{ next_number: 5 }] };
        if (sql.includes('lower(trim(description))')) {
          return { rows: [{ 1: 1 }] }; // duplicate description
        }
        return { rows: [] };
      });

      const req = {
        body: { description: 'Existing Product', unit: 'pc', unitprice: 10.00 },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toMatch(/already exists/i);
    });

    test('createProduct rejects invalid price and unit with HTTP 400 Bad Request', async () => {
      const req = {
        body: { description: 'Valid Name', unit: 'invalid_unit', unitprice: -5 },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createProduct(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.details.unit).toBeDefined();
      expect(capturedError.details.unitprice).toBeDefined();
    });
  });

  describe('Product RBAC & Permissions (HTTP 403 Forbidden)', () => {
    test('unauthorized employee without Inventory view receives HTTP 403 Forbidden', () => {
      const middleware = requirePermission('Inventory', 'view');
      const req = { user: { role: 'employee', rights: [] } };
      let statusCode = 200;
      let responseBody = null;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(statusCode).toBe(403);
      expect(responseBody.error.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('unauthorized employee without Inventory edit receives HTTP 403 on add or update', () => {
      const middleware = requirePermission('Inventory', 'edit');
      const req = { user: { role: 'employee', rights: ['products.access'] } }; // only view right
      let statusCode = 200;
      const res = { status: (s) => { statusCode = s; return res; }, json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('employee with granular products.add and products.price.add right is allowed to edit', () => {
      const middleware = requirePermission('Inventory', 'edit');
      const req = { user: { role: 'employee', rights: ['products.add', 'products.price.add'] } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Price History Effective Date Lookup Verification (lookupProductPrice)', () => {
    test('returns latest active price effective on or before the queried sales date', async () => {
      let executedSql = '';
      let executedParams = [];
      mockPool.query.mockImplementation(async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return {
          rows: [{
            prodcode: 'PX0001',
            effdate: '2026-06-01',
            unitprice: '120.00'
          }]
        };
      });

      const req = {
        params: { prodcode: 'PX0001' },
        query: { salesdate: '2026-08-15' }
      };
      let responseBody = null;
      let statusCode = 200;
      const res = {
        status: (s) => { statusCode = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await lookupProductPrice(req, res, (err) => { if (err) throw err; });

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.prodcode).toBe('PX0001');
      expect(responseBody.data.salesdate).toBe('2026-08-15');
      expect(responseBody.data.effdate).toBe('2026-06-01');
      expect(responseBody.data.unitprice).toBe(120.00);

      // Verify SQL assertions for price lookup
      expect(executedSql).toContain('ph.prodcode = $1');
      expect(executedSql).toContain('ph.effdate <= $2::date');
      expect(executedSql).toContain('ph.is_deleted = false');
      expect(executedSql).toContain('ORDER BY ph.effdate DESC');
      expect(executedSql).toContain('LIMIT 1');
      expect(executedParams).toEqual(['PX0001', '2026-08-15']);
    });

    test('returns exact match price when queried sales date matches effective date exactly', async () => {
      mockPool.query.mockImplementation(async () => ({
        rows: [{ prodcode: 'PX0001', effdate: '2026-06-01', unitprice: '120.00' }]
      }));

      const req = {
        params: { prodcode: 'PX0001' },
        query: { salesdate: '2026-06-01' }
      };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await lookupProductPrice(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.effdate).toBe('2026-06-01');
      expect(responseBody.data.unitprice).toBe(120.00);
    });

    test('returns previous price tier when queried date is between effective dates', async () => {
      mockPool.query.mockImplementation(async (sql, params) => {
        expect(params[1]).toBe('2026-05-31'); // Prior to 2026-06-01 tier
        return {
          rows: [{ prodcode: 'PX0001', effdate: '2026-01-01', unitprice: '100.00' }]
        };
      });

      const req = {
        params: { prodcode: 'PX0001' },
        query: { salesdate: '2026-05-31' }
      };
      let responseBody = null;
      const res = { json: (data) => { responseBody = data; return res; } };

      await lookupProductPrice(req, res, (err) => { if (err) throw err; });

      expect(responseBody.data.effdate).toBe('2026-01-01');
      expect(responseBody.data.unitprice).toBe(100.00);
    });

    test('returns HTTP 404 Not Found when queried sales date is earlier than all effective dates', async () => {
      mockPool.query.mockImplementation(async () => ({ rows: [] }));

      const req = {
        params: { prodcode: 'PX0001' },
        query: { salesdate: '2025-12-31' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await lookupProductPrice(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/No active price found for product PX0001 as of 2025-12-31/i);
    });

    test('rejects invalid salesdate format with HTTP 400 Bad Request', async () => {
      const req = {
        params: { prodcode: 'PX0001' },
        query: { salesdate: '01-12-2026' } // invalid non YYYY-MM-DD
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await lookupProductPrice(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/salesdate must be a valid date in YYYY-MM-DD format/i);
    });

    test('rejects empty product code with HTTP 400 Bad Request', async () => {
      const req = {
        params: { prodcode: '   ' },
        query: { salesdate: '2026-10-01' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await lookupProductPrice(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/product code is required/i);
    });
  });
});

