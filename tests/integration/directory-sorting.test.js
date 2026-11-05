import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockPool;

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: { requirePool: () => mockPool }
};

const { listCustomers } = require('../../controllers/customer-controller');
const { listProducts } = require('../../controllers/product-controller');

function invoke(handler, query) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); return this; }
    };
    handler({ query }, res, (error) => {
      if (error) {
        res.statusCode = error.statusCode || 500;
        res.body = { success: false, error: { message: error.message } };
      }
      resolve(res);
    });
  });
}

beforeEach(() => {
  mockPool = {
    query: vi.fn(async (sql) => ({
      rows: typeof sql === 'string' && sql.includes('count(*)::integer AS total')
        ? [{ total: 0 }]
        : []
    }))
  };
});

describe('customer directory sorting', () => {
  it('uses the allowlisted ID sort and requested page size', async () => {
    const response = await invoke(listCustomers, { page: '2', limit: '50', sortBy: 'customerId', sortOrder: 'desc' });
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY custno DESC');
    expect(params.slice(-2)).toEqual([50, 50]);
    expect(response.body.data.pagination.limit).toBe(50);
  });

  it('rejects unknown sort fields before querying', async () => {
    const response = await invoke(listCustomers, { sortBy: 'custno; DROP TABLE customer', sortOrder: 'asc' });
    expect(response.statusCode).toBe(400);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});

describe('product directory sorting', () => {
  it('sorts current unit prices with null values last', async () => {
    const response = await invoke(listProducts, { page: '1', limit: '25', sortBy: 'unitPrice', sortOrder: 'desc' });
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY price.unitprice DESC NULLS LAST, p.prodcode ASC');
    expect(params.slice(-2)).toEqual([25, 0]);
    expect(response.statusCode).toBe(200);
  });

  it('rejects invalid sort directions before querying', async () => {
    const response = await invoke(listProducts, { sortBy: 'description', sortOrder: 'sideways' });
    expect(response.statusCode).toBe(400);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
