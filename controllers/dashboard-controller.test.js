// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const {
  getDashboardStats,
  clearDashboardCache,
  getDashboardCache,
  STATS_CACHE_TTL_MS,
} = require('./dashboard-controller');

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('controllers/dashboard-controller ([S4-DEV-09])', () => {
  beforeEach(() => {
    pool.query.mockReset();
    clearDashboardCache();
  });

  test('populates and clears getDashboardCache metadata and supports snake_case open_orders alias', async () => {
    expect(getDashboardCache()).toEqual({ cachedStats: null, cachedStatsExpiresAt: 0 });

    pool.query.mockResolvedValueOnce({
      rows: [{ customers: '12', products: '8', open_orders: '3', revenue: '450.25' }],
    });

    const res = createRes();
    await getDashboardStats({ query: {} }, res, () => {});

    expect(res.body.data).toEqual({ customers: 12, products: 8, openOrders: 3, revenue: 450.25 });
    const cache = getDashboardCache();
    expect(cache.cachedStats).toEqual({ customers: 12, products: 8, openOrders: 3, revenue: 450.25 });
    expect(cache.cachedStatsExpiresAt).toBeGreaterThan(Date.now() - 100);
    expect(STATS_CACHE_TTL_MS).toBe(5000);

    clearDashboardCache();
    expect(getDashboardCache()).toEqual({ cachedStats: null, cachedStatsExpiresAt: 0 });
  });

  test('bypasses cache when fresh="1" string query parameter is supplied', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ customers: '1', products: '2', openorders: '1', revenue: '10' }] })
      .mockResolvedValueOnce({ rows: [{ customers: '2', products: '2', openorders: '2', revenue: '20' }] });

    const res1 = createRes();
    await getDashboardStats({ query: {} }, res1, () => {});
    expect(res1.body.data.openOrders).toBe(1);

    const res2 = createRes();
    await getDashboardStats({ query: { fresh: '1' } }, res2, () => {});
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(res2.body.data).toEqual({ customers: 2, products: 2, openOrders: 2, revenue: 20 });
  });
});
