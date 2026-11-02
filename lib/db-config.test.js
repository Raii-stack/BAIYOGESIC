import { expect, test } from 'vitest';
import db from '../db.js';

test('rewrites direct Supabase IPv6 host to the IPv4 transaction pooler and strips sslmode for Vercel', () => {
  const config = db.resolveDatabaseConfig(
    'postgresql://postgres:secret@db.dtcxvlcpqjmutiwejyqk.supabase.co:5432/postgres?sslmode=require',
    'https://dtcxvlcpqjmutiwejyqk.supabase.co',
    '',
    'production'
  );

  expect(config.connectionString).toBe(
    'postgresql://postgres.dtcxvlcpqjmutiwejyqk:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
  );
  expect(config.ssl).toEqual({ rejectUnauthorized: false });
});

test('keeps serverless pools small and respects an explicit connection budget', () => {
  const previous = process.env.DATABASE_POOL_MAX;
  try {
    delete process.env.DATABASE_POOL_MAX;
    expect(db.resolveDatabaseConfig('postgresql://user:secret@localhost:5432/test').max).toBe(2);
    process.env.DATABASE_POOL_MAX = '4';
    expect(db.resolveDatabaseConfig('postgresql://user:secret@localhost:5432/test').max).toBe(4);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_POOL_MAX;
    else process.env.DATABASE_POOL_MAX = previous;
  }
});

test('normalizes pooler URLs with sslmode=require so pg does not fail certificate verification', () => {
  const config = db.resolveDatabaseConfig(
    'postgresql://postgres:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require',
    'https://dtcxvlcpqjmutiwejyqk.supabase.co',
    '',
    'production'
  );

  expect(config.connectionString).toBe(
    'postgresql://postgres.dtcxvlcpqjmutiwejyqk:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
  );
  expect(config.ssl).toEqual({ rejectUnauthorized: false });
});
