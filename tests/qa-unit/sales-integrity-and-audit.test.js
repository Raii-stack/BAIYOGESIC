const fs = require('fs');
const path = require('path');
const { MIGRATION_REGEX } = require('../../scripts/verify-migrations');

let mockQueryHandler = null;
const mockClient = {
  query: jest.fn().mockImplementation((sql, params) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || (typeof sql === 'string' && sql.includes('set_config'))) {
      return Promise.resolve({ rows: [] });
    }
    if (mockQueryHandler) {
      return mockQueryHandler(sql, params);
    }
    return Promise.resolve({ rows: [] });
  }),
  release: jest.fn()
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient)
};

jest.mock('../../db', () => ({
  requirePool: () => mockPool,
  pool: mockPool,
  supabase: {
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
  }
}));

const { archiveSale } = require('../../controllers/sales-controller');

describe('Issue #76: Sales Child Delete Integrity Rules & Audit Log Filter Queries', () => {
  const migrationPath = path.join(
    __dirname,
    '../../supabase/migrations/20261102010000_issue_76_sales_delete_rules_and_audit_log_queries.sql'
  );

  let migrationSql = '';

  beforeAll(() => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    migrationSql = fs.readFileSync(migrationPath, 'utf8');
  });

  describe('1. Migration File Sequence and Naming Standards', () => {
    test('migration filename matches strict YYYYMMDDHHMMSS_<description>.sql format', () => {
      const filename = path.basename(migrationPath);
      expect(filename).toMatch(MIGRATION_REGEX);
    });

    test('migration timestamp strictly succeeds prior query optimization migration', () => {
      const match = path.basename(migrationPath).match(MIGRATION_REGEX);
      expect(match).not.toBeNull();
      const timestamp = match[1];
      expect(timestamp).toBe('20261102010000');
      expect(timestamp > '20261031000000').toBe(true);
    });
  });

  describe('2. Foreign Key Relational Schema & Delete Constraints', () => {
    test('enforces ON DELETE RESTRICT on sales -> customer foreign key', () => {
      expect(migrationSql).toContain('sales_custno_fkey');
      expect(migrationSql).toContain('REFERENCES public.customer(custno)');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });

    test('enforces ON DELETE RESTRICT on sales -> employee foreign key', () => {
      expect(migrationSql).toContain('sales_empno_fkey');
      expect(migrationSql).toContain('REFERENCES public.employee(empno)');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });

    test('enforces ON DELETE CASCADE on salesdetail -> sales foreign key', () => {
      expect(migrationSql).toContain('salesdetail_transno_fkey');
      expect(migrationSql).toContain('REFERENCES public.sales(transno)');
      expect(migrationSql).toContain('ON DELETE CASCADE');
    });

    test('enforces ON DELETE RESTRICT on salesdetail -> product foreign key', () => {
      expect(migrationSql).toContain('salesdetail_prodcode_fkey');
      expect(migrationSql).toContain('REFERENCES public.product(prodcode)');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });

    test('enforces ON DELETE RESTRICT on payment -> sales to prevent orphaned payments', () => {
      expect(migrationSql).toContain('payment_transno_fkey');
      expect(migrationSql).toContain('REFERENCES public.sales(transno)');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });
  });

  describe('3. Two-Tier Hard-Delete and Soft-Delete Integrity Triggers', () => {
    test('implements hard-delete prevention triggers on sales, salesdetail, and payment', () => {
      expect(migrationSql).toContain('FUNCTION public.trg_block_hard_delete');
      expect(migrationSql).toContain('CREATE TRIGGER sales_bd_block');
      expect(migrationSql).toContain('CREATE TRIGGER salesdetail_bd_block');
      expect(migrationSql).toContain('CREATE TRIGGER payment_bd_block');
    });

    test('implements soft-delete child integrity check blocking deletion of sales with active payments', () => {
      expect(migrationSql).toContain('FUNCTION public.trg_check_children');
      expect(migrationSql).toContain("WHEN 'sales' THEN");
      expect(migrationSql).toContain('public.payment');
      expect(migrationSql).toContain('CREATE TRIGGER sales_bu_check');
      expect(migrationSql).toContain('CREATE TRIGGER customer_bu_check');
      expect(migrationSql).toContain('CREATE TRIGGER product_bu_check');
    });

    test('implements cascading soft-delete and restore trigger on salesdetail', () => {
      expect(migrationSql).toContain('FUNCTION public.trg_sales_cascade_soft_delete');
      expect(migrationSql).toContain('CREATE TRIGGER sales_au_cascade_soft_delete');
      expect(migrationSql).toContain('AFTER UPDATE OF is_deleted ON public.sales');
    });
  });

  describe('4. Audit Log Covering Indexes and Filter Query Procedures', () => {
    test('creates composite indexes for multi-filter audit queries', () => {
      expect(migrationSql).toContain('audit_log_table_action_at_idx');
      expect(migrationSql).toContain('audit_log_actor_action_at_idx');
      expect(migrationSql).toContain('audit_log_action_at_idx');
      expect(migrationSql).toContain('audit_log_composite_filter_idx');
    });

    test('defines optimized query_audit_logs function with single-roundtrip window pagination', () => {
      expect(migrationSql).toContain('FUNCTION public.query_audit_logs');
      expect(migrationSql).toContain('p_table_name varchar');
      expect(migrationSql).toContain('p_action varchar');
      expect(migrationSql).toContain('p_action_by varchar');
      expect(migrationSql).toContain('p_from timestamptz');
      expect(migrationSql).toContain('p_to timestamptz');
      expect(migrationSql).toContain('p_limit integer');
      expect(migrationSql).toContain('p_offset integer');
      expect(migrationSql).toContain('count(*) OVER()::integer AS total_count');
      expect(migrationSql).toContain('count(*) OVER()::integer AS _total');
    });

    test('defines filter_audit_logs procedure alias and audit_log_filtered_view', () => {
      expect(migrationSql).toContain('FUNCTION public.filter_audit_logs');
      expect(migrationSql).toContain('VIEW public.audit_log_filtered_view');
    });
  });

  describe('5. Application Layer Error Handling Alignment', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockQueryHandler = null;
    });

    test('archiveSale blocks archiving if active payments exist returning HTTP 409', async () => {
      mockQueryHandler = (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT transno, is_deleted FROM public.sales')) {
          return Promise.resolve({ rows: [{ transno: 'TR-100', is_deleted: false }] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.payment')) {
          return Promise.resolve({ rows: [{ exists: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      };

      const req = {
        params: { transno: 'TR-100' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };

      let errorCaught = null;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = (err) => { errorCaught = err; };

      await archiveSale(req, res, next);
      expect(errorCaught).not.toBeNull();
      expect(errorCaught.statusCode).toBe(409);
      expect(errorCaught.message).toMatch(/cannot archive a sales order that already has recorded payments/i);
    });

    test('archiveSale maps database trigger P0001 exception into HTTP 409 Conflict', async () => {
      const triggerError = new Error('Cannot delete sales row: 1 active related record(s) still exist.');
      triggerError.code = 'P0001';

      mockQueryHandler = (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT transno, is_deleted FROM public.sales')) {
          return Promise.resolve({ rows: [{ transno: 'TR-200', is_deleted: false }] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.payment')) {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.sales SET is_deleted = true')) {
          return Promise.reject(triggerError);
        }
        return Promise.resolve({ rows: [] });
      };

      const req = {
        params: { transno: 'TR-200' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };

      let errorCaught = null;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = (err) => { errorCaught = err; };

      await archiveSale(req, res, next);
      expect(errorCaught).not.toBeNull();
      expect(errorCaught.statusCode).toBe(409);
      expect(errorCaught.message).toMatch(/cannot archive a sales order that already has recorded payments/i);
    });

    test('archiveSale maps foreign key 23503 violation into HTTP 409 Conflict', async () => {
      const fkError = new Error('update or delete on table "sales" violates foreign key constraint "payment_transno_fkey"');
      fkError.code = '23503';

      mockQueryHandler = (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT transno, is_deleted FROM public.sales')) {
          return Promise.resolve({ rows: [{ transno: 'TR-300', is_deleted: false }] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.payment')) {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.sales SET is_deleted = true')) {
          return Promise.reject(fkError);
        }
        return Promise.resolve({ rows: [] });
      };

      const req = {
        params: { transno: 'TR-300' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };

      let errorCaught = null;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = (err) => { errorCaught = err; };

      await archiveSale(req, res, next);
      expect(errorCaught).not.toBeNull();
      expect(errorCaught.statusCode).toBe(409);
      expect(errorCaught.message).toMatch(/cannot archive a sales order that already has recorded payments/i);
    });
  });
});
