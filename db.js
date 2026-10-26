const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  SUPABASE_KEY ||
  ''
).trim();
const DATABASE_URL = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  ''
).trim();
const DATABASE_POOLER_HOST = (process.env.DATABASE_POOLER_HOST || '').trim();
const DEFAULT_SUPABASE_POOLER_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be configured');
}

/**
 * The Supabase client maintains its HTTP connection pool and is safe to reuse
 * across requests. Keep this module server-side because the key may be privileged.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const authSupabase = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'sb-service-role-auth-token'
      }
    })
  : null;

function resolveDatabaseConfig(
  rawUrl = DATABASE_URL,
  supabaseUrl = SUPABASE_URL,
  poolerHostEnv = DATABASE_POOLER_HOST,
  nodeEnv = process.env.NODE_ENV
) {
  if (!rawUrl) return null;

  const connection = new URL(rawUrl);
  const directMatch = connection.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  const supabaseRef = (() => {
    try {
      return new URL(supabaseUrl).hostname.split('.')[0];
    } catch {
      return '';
    }
  })();
  const projectRef = (directMatch && directMatch[1]) || supabaseRef;
  const poolerHost = poolerHostEnv || (directMatch ? DEFAULT_SUPABASE_POOLER_HOST : '');

  if (poolerHost) {
    connection.hostname = poolerHost;
    connection.port = '5432';
    if (projectRef) {
      connection.username = `postgres.${projectRef}`;
    }
  } else if (
    /\.pooler\.supabase\.com$/i.test(connection.hostname) &&
    projectRef &&
    connection.username === 'postgres'
  ) {
    connection.username = `postgres.${projectRef}`;
  }

  // Strip sslmode/uselibpqcompat query params so pg-connection-string does not
  // override `ssl: { rejectUnauthorized: false }` with strict verify-full on Vercel.
  connection.searchParams.delete('sslmode');
  connection.searchParams.delete('uselibpqcompat');

  const isLocalhost =
    connection.hostname === 'localhost' || connection.hostname === '127.0.0.1';

  return {
    connectionString: connection.toString(),
    ssl:
      isLocalhost && nodeEnv !== 'production'
        ? undefined
        : { rejectUnauthorized: false },
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || '5', 10),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
  };
}

const pool = DATABASE_URL ? new Pool(resolveDatabaseConfig()) : null;

function requirePool() {
  if (!pool) {
    const error = new Error('DATABASE_URL must be configured for authenticated database routes');
    error.statusCode = 503;
    throw error;
  }

  return pool;
}

module.exports = {
  supabase,
  authSupabase,
  pool,
  requirePool,
  resolveDatabaseConfig
};
