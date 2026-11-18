const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #56: CRM & Inventory Demo Data, Payment Terms & Price History Seed', () => {
  const sprint2Sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261020000002_sprint2_crm_inventory.sql'),
    'utf8'
  );
  const issue56Sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261026000000_issue_56_customer_demo_data.sql'),
    'utf8'
  );
  const seedSql = fs.readFileSync(path.join(ROOT, 'supabase', 'seed.sql'), 'utf8');

  test('Sprint 2 CRM/Inventory migration defines active views, unit check, and current_active_price()', () => {
    expect(sprint2Sql).toContain('CREATE OR REPLACE VIEW public.customer_active');
    expect(sprint2Sql).toContain('CREATE OR REPLACE VIEW public.product_active');
    expect(sprint2Sql).toContain("CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'))");
    expect(sprint2Sql).toContain('CREATE OR REPLACE FUNCTION public.current_active_price(p_prodcode varchar)');
  });

  test('Issue #56 migration updates customer_payterm_check to include 60D alongside COD, 30D, and 45D', () => {
    expect(issue56Sql).toContain('DROP CONSTRAINT IF EXISTS customer_payterm_check');
    expect(issue56Sql).toContain("CHECK (payterm IN ('COD', '30D', '45D', '60D'))");
  });

  test('seed.sql populates idempotent customer, product, and multi-tier pricehist demo records', () => {
    expect(seedSql).toContain('INSERT INTO public.customer (custno, custname, address, payterm, is_deleted)');
    expect(seedSql).toContain("'C1001'");
    expect(seedSql).toContain("'C1025'");
    expect(seedSql).toContain("'60D'");
    expect(seedSql).toContain('ON CONFLICT (custno) DO UPDATE');

    expect(seedSql).toContain('INSERT INTO public.product (prodcode, description, unit, is_deleted)');
    expect(seedSql).toContain("'P1001'");
    expect(seedSql).toContain("'P1012'");
    expect(seedSql).toContain('ON CONFLICT (prodcode) DO UPDATE');

    expect(seedSql).toContain('INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)');
    expect(seedSql).toContain("('2025-01-15', 'P1001', 18.50, false)");
    expect(seedSql).toContain("('2026-01-15', 'P1001', 20.00, false)");
    expect(seedSql).toContain('ON CONFLICT (effdate, prodcode) DO UPDATE');
  });
});
