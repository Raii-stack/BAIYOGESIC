async function nextProductCode(client) {
  // PX is reserved for catalog entries created by this application.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('public.product.prodcode.PX'))");
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(prodcode FROM 3)::integer), 0) + 1 AS next_number
     FROM public.product
     WHERE prodcode ~ '^PX[0-9]{4}$'`
  );
  const nextNumber = Number(result.rows[0].next_number);

  if (nextNumber > 9999) {
    const error = new Error('Product code limit reached; no more PX codes are available');
    error.statusCode = 409;
    throw error;
  }

  return `PX${String(nextNumber).padStart(4, '0')}`;
}

module.exports = { nextProductCode };
