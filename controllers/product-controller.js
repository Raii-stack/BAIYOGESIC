const { requirePool } = require('../db');
const { nextProductCode } = require('../lib/product-code');
const { asyncHandler } = require('../middleware/error-handler');

const UNITS = new Set(['pc', 'ea', 'mtr', 'pkg', 'ltr']);
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

function validateProduct(body) {
  const source = body || {};
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  const unit = typeof source.unit === 'string' ? source.unit.trim().toLowerCase() : '';
  const priceText = String(source.unitprice ?? '');
  const unitprice = Number(priceText);

  if (!description || description.length > 30) {
    throw requestError('Description is required and must be at most 30 characters', 400);
  }
  if (!UNITS.has(unit)) {
    throw requestError('Unit must be pc, ea, mtr, pkg, or ltr', 400);
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(unitprice) || unitprice <= 0 || unitprice > 99999999.99) {
    throw requestError('Unit price must be greater than zero, at most 99,999,999.99, and have no more than two decimal places', 400);
  }

  return { description, unit, unitprice };
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
  if (unit && !UNITS.has(unit)) throw requestError('Invalid unit filter', 400);

  const filters = ['p.is_deleted = false'];
  const values = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(p.prodcode ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
  }
  if (unit) {
    values.push(unit);
    filters.push(`p.unit = $${values.length}`);
  }
  const whereClause = `WHERE ${filters.join(' AND ')}`;
  const countValues = [...values];
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const [productsResult, countResult] = await Promise.all([
    requirePool().query(
      `SELECT p.prodcode, p.description, p.unit, p.is_deleted, p.stamp,
              price.unitprice, price.effdate::text AS effdate
       FROM public.product p
       LEFT JOIN (
         SELECT DISTINCT ON (prodcode) prodcode, unitprice, effdate
         FROM public.pricehist
         WHERE is_deleted = false AND effdate <= CURRENT_DATE
         ORDER BY prodcode, effdate DESC
       ) price ON price.prodcode = p.prodcode
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
    'SELECT 1 FROM public.product WHERE prodcode = $1 AND is_deleted = false',
    [prodcode]
  );
  if (!productResult.rows.length) throw requestError('Product not found', 404);

  const historyResult = await requirePool().query(
    `SELECT effdate::text AS effdate, unitprice, stamp
     FROM public.pricehist
     WHERE prodcode = $1 AND is_deleted = false
     ORDER BY effdate DESC`,
    [prodcode]
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
         VALUES (CURRENT_DATE, $1, $2, false)
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
       WHERE prodcode = $1 AND is_deleted = false AND effdate <= CURRENT_DATE
       ORDER BY effdate DESC LIMIT 1`,
      [prodcode]
    );
    if (!currentPrice.rows.length || Number(currentPrice.rows[0].unitprice) !== unitprice) {
      await client.query(
        `INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
         VALUES (CURRENT_DATE, $1, $2, false)
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
  const product = await withAuditContext(req.user.email, async (client) => {
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
  if (!product) throw requestError('Product not found', 404);
  res.json({ success: true, data: { product } });
});

module.exports = { listProducts, getPriceHistory, createProduct, updateProduct, archiveProduct };
