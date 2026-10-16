const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { SUPABASE_URL, SUPABASE_KEY } = process.env;

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

module.exports = { supabase };
