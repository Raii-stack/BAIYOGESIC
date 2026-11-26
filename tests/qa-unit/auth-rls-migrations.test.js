const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #20: Auth, RBAC Tables, Reset Tokens & RLS Migrations', () => {
  const rlsSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261017175500_enable_rls_on_public_tables.sql'),
    'utf8'
  );
  const resetTokenSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261020000000_create_password_reset_tokens.sql'),
    'utf8'
  );
  const rbacSeedSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261020000001_seed_rbac_and_configure_audit_user.sql'),
    'utf8'
  );

  test('enables Row Level Security across all 11 core public ERP tables', () => {
    const tables = [
      'employee',
      'department',
      'job',
      'jobhistory',
      'customer',
      'sales',
      'product',
      'salesdetail',
      'payment',
      'pricehist',
      'audit_log'
    ];

    for (const table of tables) {
      expect(rlsSql).toContain(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  });

  test('creates password_reset_token with hashed token PK, partial active index, and RLS', () => {
    expect(resetTokenSql).toMatch(/create table if not exists public\.password_reset_token/i);
    expect(resetTokenSql).toMatch(/token_hash text primary key/i);
    expect(resetTokenSql).toMatch(/user_id uuid not null references public\.app_user \(user_id\)/i);
    expect(resetTokenSql).toMatch(/create index if not exists password_reset_token_active_idx/i);
    expect(resetTokenSql).toMatch(/where used = false/i);
    expect(resetTokenSql).toMatch(/alter table public\.password_reset_token enable row level security/i);
  });

  test('defines RBAC tables with RLS, service_role grants, and audit_user() fallback', () => {
    expect(rbacSeedSql).toContain('CREATE TABLE IF NOT EXISTS public.app_module');
    expect(rbacSeedSql).toContain('CREATE TABLE IF NOT EXISTS public.app_role');
    expect(rbacSeedSql).toContain('CREATE TABLE IF NOT EXISTS public.app_role_permission');
    expect(rbacSeedSql).toContain('ALTER TABLE public.app_module ENABLE ROW LEVEL SECURITY;');
    expect(rbacSeedSql).toContain('ALTER TABLE public.app_role ENABLE ROW LEVEL SECURITY;');
    expect(rbacSeedSql).toContain('ALTER TABLE public.app_role_permission ENABLE ROW LEVEL SECURITY;');
    expect(rbacSeedSql).toContain('REVOKE ALL ON TABLE public.app_module, public.app_role, public.app_role_permission');
    expect(rbacSeedSql).toContain('CREATE OR REPLACE FUNCTION public.audit_user()');
    expect(rbacSeedSql).toContain("current_setting('app.username', true)");
  });
});
