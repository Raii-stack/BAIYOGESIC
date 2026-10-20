const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL,
  DATABASE_POOLER_HOST
} = process.env;

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
        detectSessionInUrl: false
      }
    })
  : null;

function databaseConnectionString() {
  if (!DATABASE_URL || !DATABASE_POOLER_HOST) return DATABASE_URL;
  const connection = new URL(DATABASE_URL);
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  connection.hostname = DATABASE_POOLER_HOST;
  connection.port = '5432';
  connection.username = `postgres.${projectRef}`;
  return connection.toString();
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: databaseConnectionString(),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    })
  : null;

function requirePool() {
  if (!pool) {
    const error = new Error('DATABASE_URL must be configured for authenticated database routes');
    error.statusCode = 503;
    throw error;
  }

  return pool;
}

module.exports = { supabase, authSupabase, pool, requirePool };
