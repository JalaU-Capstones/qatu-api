import { supabase } from '../../infrastructure/config/supabase.js';

/**
 * Express middleware that verifies Supabase JWTs via the Supabase Auth API.
 * Supabase v2 signs JWTs with ES256 (asymmetric). Verifying locally with a
 * shared secret (jsonwebtoken + HS256) does not work and must not be reintroduced.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  const authHeader = req.headers?.authorization;

  const unauthorized = () =>
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication failed' },
      meta: { timestamp },
    });

  if (!authHeader || !authHeader.startsWith('Bearer ')) return unauthorized();
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return unauthorized();

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return unauthorized();

    req.user = {
      id: data.user.id,
      // App role lives in user_metadata; fall back to Supabase's "authenticated" role.
      role: data.user.user_metadata?.role ?? data.user.role ?? null,
      email: data.user.email ?? null,
    };

    return next();
  } catch {
    return unauthorized();
  }
}

export const requireAuth = authMiddleware;
