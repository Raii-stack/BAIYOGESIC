const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

const STATS_CACHE_TTL_MS = 5000; // 5-second in-memory cache TTL

let cachedStats = null;
let cachedStatsExpiresAt = 0;

function clearDashboardCache() {
  cachedStats = null;
  cachedStatsExpiresAt = 0;
}

function getDashboardCache() {
  return { cachedStats, cachedStatsExpiresAt };
}

const getDashboardStats = asyncHandler(async (req, res) => {
  const bypassCache = req.query.refresh === 'true' || req.query.fresh === '1';
  const now = Date.now();

  if (!bypassCache && cachedStats && cachedStatsExpiresAt > now) {
    return res.json({
      success: true,
      data: cachedStats,
      ...cachedStats
    });
  }

  const pool = requirePool();
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::integer FROM public.customer WHERE is_deleted = false) AS customers,
       (SELECT count(*)::integer FROM public.product WHERE is_deleted = false) AS products,
       (SELECT count(*)::integer FROM public.sales_balance_view WHERE is_deleted = false AND balance > 0) AS "openOrders",
       (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM public.sales_balance_view WHERE is_deleted = false) AS revenue`
  );

  const row = result.rows[0] || {};
  const stats = {
    customers: Number.parseInt(row.customers, 10) || 0,
    products: Number.parseInt(row.products, 10) || 0,
    openOrders: Number.parseInt(row.openOrders ?? row.open_orders ?? row.openorders, 10) || 0,
    revenue: Number.parseFloat(row.revenue) || 0
  };

  cachedStats = stats;
  cachedStatsExpiresAt = now + STATS_CACHE_TTL_MS;

  res.json({
    success: true,
    data: stats,
    ...stats
  });
});

module.exports = {
  getDashboardStats,
  clearDashboardCache,
  getDashboardCache,
  STATS_CACHE_TTL_MS
};
