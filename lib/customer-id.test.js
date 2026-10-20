import { expect, test, vi } from 'vitest';
import customerId from './customer-id.js';

test('allocates the next five-character customer ID inside a transaction lock', async () => {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ next_number: 83 }] })
  };

  await expect(customerId.nextCustomerId(client)).resolves.toBe('C0083');
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  expect(client.query.mock.calls[1][0]).toContain('FROM public.customer');
});

test('rejects an ID beyond the five-character customer limit', async () => {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ next_number: 10000 }] })
  };

  await expect(customerId.nextCustomerId(client)).rejects.toMatchObject({ statusCode: 409 });
});
