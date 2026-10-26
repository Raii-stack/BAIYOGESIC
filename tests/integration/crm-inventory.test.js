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
  getPriceHistory,
  addPriceHistory,
  archiveProduct,
  restoreProduct
} = require('../../controllers/product-controller');
const {
  deleteCustomer,
  restoreCustomer
} = require('../../controllers/customer-controller');
const productRoutes = require('../../routes/product-routes');
const customerRoutes = require('../../routes/customer-routes');

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

      // Verify audit_log query was executed with action PRICE_UPDATE
      const auditCall = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log')
      );
      expect(auditCall).toBeDefined();
      const [sql, params] = auditCall;
      expect(sql).toContain('PRICE_UPDATE');
      expect(params[0]).toBe('P1001'); // record_key
      const oldVals = JSON.parse(params[1]);
      const newVals = JSON.parse(params[2]);
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
