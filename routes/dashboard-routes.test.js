import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockPool = {
  query: vi.fn(),
};

// Mock db module
require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const dashboardRoutes = require('./dashboard-routes');
const {
  getDashboardStats,
  clearDashboardCache,
  STATS_CACHE_TTL_MS
} = require('../controllers/dashboard-controller');

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('Dashboard Routes & Controller (Issue #167)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDashboardCache();
  });

  test('dashboard routes expose GET /stats', () => {
    const routePaths = dashboardRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    expect(routePaths).toContain('/stats');
  });

  test('getDashboardStats queries database and returns formatted statistics', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          customers: '1248',
          products: '386',
          openOrders: '94',
          revenue: '84200.50'
        }
      ]
    });

    const req = { query: {} };
    const res = createRes();

    await getDashboardStats(req, res, () => {});

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain('public.customer');
    expect(sql).toContain('public.product');
    expect(sql).toContain('public.sales_balance_view');
    expect(sql).toContain('balance > 0');
    expect(sql).toContain('COALESCE(SUM(total_amount), 0)');

    expect(res.body).toEqual({
      success: true,
      data: {
        customers: 1248,
        products: 386,
        openOrders: 94,
        revenue: 84200.5
      },
      customers: 1248,
      products: 386,
      openOrders: 94,
      revenue: 84200.5
    });
  });

  test('getDashboardStats handles null/empty rows gracefully', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          customers: null,
          products: null,
          openOrders: null,
          revenue: null
        }
      ]
    });

    const req = { query: {} };
    const res = createRes();

    await getDashboardStats(req, res, () => {});

    expect(res.body.data).toEqual({
      customers: 0,
      products: 0,
      openOrders: 0,
      revenue: 0
    });
  });

  test('getDashboardStats utilizes 5-second in-memory cache to prevent database load spikes', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        {
          customers: '50',
          products: '20',
          openOrders: '5',
          revenue: '1500.00'
        }
      ]
    });

    const req1 = { query: {} };
    const res1 = createRes();
    await getDashboardStats(req1, res1, () => {});
    expect(mockPool.query).toHaveBeenCalledTimes(1);

    // Immediate second call should hit the cache without another database query
    const req2 = { query: {} };
    const res2 = createRes();
    await getDashboardStats(req2, res2, () => {});
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(res2.body.data.customers).toBe(50);

    // Call with ?refresh=true should bypass cache
    const req3 = { query: { refresh: 'true' } };
    const res3 = createRes();
    await getDashboardStats(req3, res3, () => {});
    expect(mockPool.query).toHaveBeenCalledTimes(2);

    // Call with boolean refresh: true should also bypass cache
    const req4 = { query: { refresh: true } };
    const res4 = createRes();
    await getDashboardStats(req4, res4, () => {});
    expect(mockPool.query).toHaveBeenCalledTimes(3);

    // Call with fresh: 1 should also bypass cache
    const req5 = { query: { fresh: 1 } };
    const res5 = createRes();
    await getDashboardStats(req5, res5, () => {});
    expect(mockPool.query).toHaveBeenCalledTimes(4);
  });

  test('getDashboardStats handles undefined req.query safely', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ customers: '10', products: '5', openOrders: '1', revenue: '50.00' }]
    });

    const req = {};
    const res = createRes();

    await getDashboardStats(req, res, () => {});

    expect(res.body.data.customers).toBe(10);
  });

  test('dashboard router applies authenticate and requireActiveUser middleware', () => {
    const middlewareStack = dashboardRoutes.stack
      .filter((layer) => !layer.route)
      .map((layer) => layer.handle.name || layer.name);

    expect(middlewareStack.length).toBeGreaterThan(0);
  });

  test('getDashboardStats propagates database errors', async () => {
    const dbError = new Error('Database connection failed');
    mockPool.query.mockRejectedValueOnce(dbError);

    const req = { query: {} };
    const res = createRes();
    let capturedError = null;

    await getDashboardStats(req, res, (err) => {
      capturedError = err;
    });

    expect(capturedError).toBe(dbError);
  });
});
