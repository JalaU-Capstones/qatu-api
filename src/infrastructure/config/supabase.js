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
  key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY,
  options = {}
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
    ...options,
  });
}

/**
 * Creates a Supabase client scoped to a specific user session by forwarding
 * the user's access token (JWT) as the Authorization header. Use for any
 * storage or DB call that must run as that user (RLS enforcement with
 * auth.uid() = sub).
 *
 * The access token MUST come from the HttpOnly `access_token` cookie on the
 * incoming Express request. This helper is server-only; the token is never
 * exposed to the client.
 *
 * @param {string} accessToken - JWT from req.cookies.access_token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserScopedSupabaseClient(accessToken) {
  if (!accessToken) {
    throw new Error('accessToken is required to create a user-scoped Supabase client');
  }
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const supabase = createSupabaseClient();
