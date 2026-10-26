const { requirePool } = require('../db');
const { nextProductCode } = require('../lib/product-code');
const { UNITS, validateProduct } = require('../lib/product-validation');
const { asyncHandler } = require('../middleware/error-handler');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
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

const listProducts = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = positiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const unit = typeof req.query.unit === 'string' ? req.query.unit.trim().toLowerCase() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
  if (unit && !UNITS.has(unit)) throw requestError('Invalid unit filter', 400);
  if (!['all', 'active', 'archived'].includes(status)) throw requestError('Invalid status filter', 400);

  const filters = [];
  const values = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(p.prodcode ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
  }
  if (unit) {
    values.push(unit);
    filters.push(`p.unit = $${values.length}`);
  }
  if (status !== 'all') {
    values.push(status === 'archived');
    filters.push(`p.is_deleted = $${values.length}`);
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countValues = [...values];
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const [productsResult, countResult] = await Promise.all([
    requirePool().query(
      `SELECT p.prodcode, p.description, p.unit, p.is_deleted, p.stamp,
              price.unitprice, price.effdate::text AS effdate
       FROM public.product p
       LEFT JOIN (
         SELECT DISTINCT ON (prodcode, is_deleted) prodcode, is_deleted, unitprice, effdate
         FROM public.pricehist
         WHERE effdate <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
         ORDER BY prodcode, is_deleted, effdate DESC
       ) price ON price.prodcode = p.prodcode AND price.is_deleted = p.is_deleted
       ${whereClause}
       ORDER BY p.description ASC, p.prodcode ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ),
    requirePool().query(
      `SELECT count(*)::integer AS total FROM public.product p ${whereClause}`,
      countValues
    )
  ]);
  const total = countResult.rows[0].total;
  res.json({
    success: true,
    data: {
      products: productsResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }
  });
});

const getPriceHistory = asyncHandler(async (req, res) => {
  const prodcode = String(req.params.prodcode || '').trim();
  const productResult = await requirePool().query(
    'SELECT is_deleted FROM public.product WHERE prodcode = $1',
    [prodcode]
  );
  if (!productResult.rows.length) throw requestError('Product not found', 404);

  const historyResult = await requirePool().query(
    `SELECT effdate::text AS effdate, unitprice, stamp
     FROM public.pricehist
     WHERE prodcode = $1 AND is_deleted = $2
     ORDER BY effdate DESC`,
    [prodcode, productResult.rows[0].is_deleted]
  );
  res.json({ success: true, data: { prices: historyResult.rows } });
});

const createProduct = asyncHandler(async (req, res) => {
  const { description, unit, unitprice } = validateProduct(req.body);
  const requestedCode = typeof req.body?.prodcode === 'string' ? req.body.prodcode.trim() : '';
  if (requestedCode.length > 6) throw requestError('Product code must be at most 6 characters', 400);

  try {
    const product = await withAuditContext(req.user.email, async (client) => {
      const prodcode = requestedCode || await nextProductCode(client);
      const result = await client.query(
        `INSERT INTO public.product (prodcode, description, unit, is_deleted)
         VALUES ($1, $2, $3, false)
         RETURNING prodcode, description, unit, is_deleted, stamp`,
        [prodcode, description, unit]
      );
      const priceResult = await client.query(
        `INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
         VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, $1, $2, false)
         RETURNING effdate::text AS effdate, unitprice`,
        [prodcode, unitprice]
      );
      return { ...result.rows[0], ...priceResult.rows[0] };
    });
    res.status(201).json({ success: true, data: { product } });
  } catch (error) {
    if (error.code === '23505') throw requestError('A product with that code already exists', 409);
    throw error;
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  const { description, unit, unitprice } = validateProduct(req.body);
  const prodcode = String(req.params.prodcode || '').trim();

  const product = await withAuditContext(req.user.email, async (client) => {
    const result = await client.query(
      `UPDATE public.product
       SET description = $1, unit = $2
       WHERE prodcode = $3 AND is_deleted = false
       RETURNING prodcode, description, unit, is_deleted, stamp`,
      [description, unit, prodcode]
    );
    if (!result.rows.length) return null;

    const currentPrice = await client.query(
      `SELECT unitprice FROM public.pricehist
       WHERE prodcode = $1 AND is_deleted = false AND effdate <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
       ORDER BY effdate DESC LIMIT 1`,
      [prodcode]
    );
    if (!currentPrice.rows.length || Number(currentPrice.rows[0].unitprice) !== unitprice) {
      await client.query(
        `INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
         VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, $1, $2, false)
         ON CONFLICT (effdate, prodcode)
         DO UPDATE SET unitprice = EXCLUDED.unitprice, is_deleted = false`,
        [prodcode, unitprice]
      );
    }
    return result.rows[0];
  });
  if (!product) throw requestError('Product not found', 404);
  res.json({ success: true, data: { product } });
});

const archiveProduct = asyncHandler(async (req, res) => {
  const prodcode = String(req.params.prodcode || '').trim();
  let product;
  try {
    product = await withAuditContext(req.user.email, async (client) => {
      const existing = await client.query(
        'SELECT prodcode FROM public.product WHERE prodcode = $1 AND is_deleted = false FOR UPDATE',
        [prodcode]
      );
      if (!existing.rows.length) return null;

      const activeSale = await client.query(
        'SELECT 1 FROM public.salesdetail WHERE prodcode = $1 AND is_deleted = false LIMIT 1',
        [prodcode]
      );
      if (activeSale.rows.length) throw requestError('Cannot archive product while active sales records exist.', 409);

      await client.query(
        'UPDATE public.pricehist SET is_deleted = true WHERE prodcode = $1 AND is_deleted = false',
        [prodcode]
      );
      const result = await client.query(
        `UPDATE public.product SET is_deleted = true
         WHERE prodcode = $1 AND is_deleted = false
         RETURNING prodcode, description, unit, is_deleted, stamp`,
        [prodcode]
      );
      return result.rows[0];
    });
  } catch (error) {
    if (error.code === 'P0001' && /active related record/i.test(error.message || '')) {
      throw requestError('Cannot archive product while active sales records exist.', 409);
    }
    throw error;
  }
  if (!product) throw requestError('Product not found', 404);
  res.json({ success: true, data: { product } });
});

const restoreProduct = asyncHandler(async (req, res) => {
  const prodcode = String(req.params.prodcode || '').trim();
  const product = await withAuditContext(req.user.email, async (client) => {
    const existing = await client.query(
      'SELECT prodcode FROM public.product WHERE prodcode = $1 AND is_deleted = true FOR UPDATE',
      [prodcode]
    );
    if (!existing.rows.length) return null;

    const result = await client.query(
      `UPDATE public.product SET is_deleted = false
       WHERE prodcode = $1 AND is_deleted = true
       RETURNING prodcode, description, unit, is_deleted, stamp`,
      [prodcode]
    );
    await client.query(
      'UPDATE public.pricehist SET is_deleted = false WHERE prodcode = $1 AND is_deleted = true',
      [prodcode]
    );
    return result.rows[0];
  });
  if (!product) throw requestError('Product not found', 404);
  res.json({ success: true, data: { product } });
});

module.exports = { listProducts, getPriceHistory, createProduct, updateProduct, archiveProduct, restoreProduct };
