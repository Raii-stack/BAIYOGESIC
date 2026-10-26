import { expect, test, vi } from 'vitest';
import productCode from './product-code.js';

test('allocates a six-character PX product code under a transaction lock', async () => {
  const client = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ next_number: 1 }] }) };
  await expect(productCode.nextProductCode(client)).resolves.toBe('PX0001');
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  expect(client.query.mock.calls[1][0]).toContain('FROM public.product');
});

test('rejects a product code after PX9999', async () => {
  const client = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ next_number: 10000 }] }) };
  await expect(productCode.nextProductCode(client)).rejects.toMatchObject({ statusCode: 409 });
});
