import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Creates and validates a Supabase client instance.
 *
 * @param {string} [url] - Supabase instance URL
 * @param {string} [key] - Service role or anon API key
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient(
  url = env.SUPABASE_URL,
  key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
) {
  if (!url) {
    throw new Error('SUPABASE_URL is required. Set it in your environment or .env file.');
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabase = createSupabaseClient();
