import jwt from 'jsonwebtoken';
import {
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
} from '../../infrastructure/auth/cookieHelper.js';
import { supabase } from '../../infrastructure/config/supabase.js';

/**
 * Express middleware that verifies Supabase JWTs.
 *
 * Supports two authentication sources during the Sprint 4 migration window
 * (per ADR-012 §"Decision"):
 *  1. `access_token` HttpOnly cookie (preferred — future default)
 *  2. `Authorization: Bearer <token>` header (deprecated, fallback only)
 *
 * When both are present, the cookie WINS. This is intentional: if the user
 * has a cookie session, downstream CSRF checks apply.
 *
 * Sets `req.authMethod` to 'cookie' or 'bearer' so downstream middleware
 * (specifically CSRF protection) can branch correctly.
 *
 * Returns `401 REFRESH_REQUIRED` when the access token is expired but a
 * refresh token is present — the frontend uses this signal to call
 * `POST /v1/auth/refresh` and retry the original request.
 *
 * Returns `401 UNAUTHORIZED` in all other failure cases.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();

  const respond = (code, message) =>
    res.status(401).json({
      error: { code, message },
      meta: { timestamp },
    });

  const cookieToken = getAccessTokenFromCookies(req);
  const authHeader = req.headers?.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

  // Prefer cookie; fall back to Bearer.
  const token = cookieToken || bearerToken;
  const authMethod = cookieToken ? 'cookie' : bearerToken ? 'bearer' : null;

  if (!token || !authMethod) {
    return respond('UNAUTHORIZED', 'Authentication failed');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      // Supabase rejected the token. Two failure modes are meaningfully different
      // for the client: expired-but-refreshable vs. hard-invalid.
      const isExpired = _isExpiredJwt(token);
      const hasRefreshCookie = Boolean(getRefreshTokenFromCookies(req));

      if (isExpired && hasRefreshCookie) {
        return respond('REFRESH_REQUIRED', 'Access token expired; refresh the session');
      }

      return respond('UNAUTHORIZED', 'Authentication failed');
    }

    req.user = {
      id: data.user.id,
      // App role lives in user_metadata; fall back to Supabase's "authenticated" role.
      role: data.user.user_metadata?.role ?? data.user.role ?? null,
      email: data.user.email ?? null,
    };
    req.authMethod = authMethod;

    return next();
  } catch {
    return respond('UNAUTHORIZED', 'Authentication failed');
  }
}

/**
 * Best-effort JWT `exp` check WITHOUT verifying the signature. Used ONLY to
 * distinguish "expired" from "hard-invalid" so we can return the appropriate
 * error code (`REFRESH_REQUIRED` vs `UNAUTHORIZED`). No authorization decision
 * is made from this — the actual authorization came from `supabase.auth.getUser()`
 * which already rejected the token.
 *
 * @param {string} token
 * @returns {boolean}
 * @private
 */
function _isExpiredJwt(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded.exp !== 'number') return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

export const requireAuth = authMiddleware;
