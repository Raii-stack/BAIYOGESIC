const MAX_CUSTOMER_NUMBER = 9999;

async function nextCustomerId(client) {
  // Keep allocation and INSERT in the same transaction so concurrent creates cannot pick the same ID.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('public.customer.custno'))");
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(custno FROM 2)::integer), 0) + 1 AS next_number
     FROM public.customer
     WHERE custno ~ '^C[0-9]{4}$'`
  );
  const nextNumber = Number(result.rows[0].next_number);

  if (nextNumber > MAX_CUSTOMER_NUMBER) {
    const error = new Error('Customer ID limit reached; no more C-number IDs are available');
    error.statusCode = 409;
    throw error;
  }

  return `C${String(nextNumber).padStart(4, '0')}`;
}

module.exports = { nextCustomerId };
