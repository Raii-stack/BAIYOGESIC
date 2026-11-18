const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #58: Trigram GIN Wildcard Search & Lookup Indexes', () => {
  const indexSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261026000001_issue_58_search_performance_indexes.sql'),
    'utf8'
  );
  const perfDoc = fs.readFileSync(
    path.join(ROOT, 'docs', 'database', 'sprint2-performance.md'),
    'utf8'
  );

  test('enables pg_trgm and creates GIN trigram indexes for customer and product wildcard searches', () => {
    expect(indexSql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    const expectedTrgmIndexes = [
      'customer_custname_trgm_idx',
      'customer_custno_trgm_idx',
      'customer_address_trgm_idx',
      'product_description_trgm_idx',
      'product_prodcode_trgm_idx'
    ];

    for (const idx of expectedTrgmIndexes) {
      expect(indexSql).toContain(`CREATE INDEX IF NOT EXISTS ${idx}`);
    }
    expect(indexSql).toContain('gin_trgm_ops');
  });

  test('creates composite descending effective-date indexes for jobhistory and pricehist', () => {
    expect(indexSql).toContain('CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_idx');
    expect(indexSql).toContain('ON public.jobhistory (empno, effdate DESC)');
    expect(indexSql).toContain('CREATE INDEX IF NOT EXISTS pricehist_prodcode_effdate_idx');
    expect(indexSql).toContain('ON public.pricehist (prodcode, effdate DESC)');
  });

  test('docs/database/sprint2-performance.md documents all indexes, EXPLAIN benchmarks, and rollback', () => {
    expect(perfDoc).toContain('customer_custno_trgm_idx');
    expect(perfDoc).toContain('product_prodcode_trgm_idx');
    expect(perfDoc).toContain('EXPLAIN (ANALYZE, BUFFERS)');
    expect(perfDoc).toContain('sub-50 ms');
    expect(perfDoc).toContain('DROP INDEX IF EXISTS public.customer_custno_trgm_idx');
  });
});
