import { getAccessTokenFromCookies } from '../../infrastructure/auth/cookieHelper.js';
import { supabase } from '../../infrastructure/config/supabase.js';

/**
 * Optional authentication middleware. Populates `req.user` when a valid
 * session token is present, but does NOT reject anonymous requests.
 * Use for routes that are public but expose extra data to authenticated
 * callers (e.g. GET /v1/products/:id returns the owner's own unpublished
 * products when the caller is authenticated).
 *
 * Contrast with `authMiddleware` which returns 401 on missing/invalid
 * tokens.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuthMiddleware(req, _res, next) {
  let user = null;
  let authMethod = null;

  try {
    const cookieToken = getAccessTokenFromCookies(req);
    const authHeader = req.headers?.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    // Prefer cookie; fall back to Bearer.
    const token = cookieToken || bearerToken;
    const tokenAuthMethod = cookieToken ? 'cookie' : bearerToken ? 'bearer' : null;

    if (token && tokenAuthMethod) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user?.id) {
        user = {
          id: data.user.id,
          // INFORMATIONAL ONLY. `user_metadata` is editable by the end user, so this value
          // must NEVER drive authorization. Resolve roles from `user_roles` (ProfileRepository).
          role: data.user.user_metadata?.role ?? data.user.role ?? null,
          email: data.user.email ?? null,
        };
        authMethod = tokenAuthMethod;
      }
    }
  } catch {
    req.user = null;
    return next();
  }

  req.user = user;
  if (authMethod) {
    req.authMethod = authMethod;
  }

  return next();
}
