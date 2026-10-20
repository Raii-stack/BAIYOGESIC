import { expect, test } from 'vitest';
import db from '../db.js';

test('rewrites direct Supabase IPv6 host to IPv4 session pooler and strips sslmode for Vercel', () => {
  const config = db.resolveDatabaseConfig(
    'postgresql://postgres:secret@db.dtcxvlcpqjmutiwejyqk.supabase.co:5432/postgres?sslmode=require',
    'https://dtcxvlcpqjmutiwejyqk.supabase.co',
    '',
    'production'
  );

  expect(config.connectionString).toBe(
    'postgresql://postgres.dtcxvlcpqjmutiwejyqk:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
  );
  expect(config.ssl).toEqual({ rejectUnauthorized: false });
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
