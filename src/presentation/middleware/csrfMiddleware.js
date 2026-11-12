import {
  getAccessTokenFromCookies,
  getCsrfTokenFromCookies,
} from '../../infrastructure/auth/cookieHelper.js';
import { verifyCsrfToken } from '../../infrastructure/auth/csrfHelper.js';

/**
 * Paths that are exempt from CSRF enforcement. These are the auth endpoints
 * declared in `components/parameters/csrf-token.yaml`:
 *   - POST /v1/auth/login
 *   - POST /v1/auth/register
 *   - POST /v1/auth/refresh
 *   - POST /v1/auth/logout
 *
 * Any request whose path starts with the prefix below is exempt. This is a
 * prefix match, so future auth endpoints added under `/v1/auth/` are
 * automatically exempt. If a future auth endpoint mutates sensitive state and
 * should be CSRF-protected, document the exception explicitly here.
 */
const AUTH_PATH_PREFIX = '/v1/auth/';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Express middleware enforcing the double-submit CSRF pattern.
 *
 * Skip logic (in order):
 *  1. Non-mutating method (GET/HEAD/OPTIONS) → skip
 *  2. Path under `/v1/auth/` → skip (auth endpoints are exempt per contract)
 *  3. No `access_token` cookie → skip (Bearer or unauthenticated request;
 *     neither can be CSRF'd because they require explicit headers/code)
 *
 * Enforce (only when ALL of the above are false):
 *  - `X-CSRF-Token` header MUST match the `csrf_token` cookie value
 *  - On mismatch or missing, respond with 403 INVALID_CSRF_TOKEN
 *
 * Mount this GLOBALLY in `app.js` after `cookieParser()` and before route
 * mounting. See API-35-08 for the wiring.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function csrfMiddleware(req, res, next) {
  // 1. Non-mutating methods are exempt.
  if (!MUTATING_METHODS.has(req.method)) return next();

  // 2. Auth endpoints are exempt per the OpenAPI contract.
  if (typeof req.path === 'string' && req.path.startsWith(AUTH_PATH_PREFIX)) {
    return next();
  }

  // 3. Only enforce CSRF when the request is cookie-authenticated.
  //    (Bearer requests must include an explicit Authorization header,
  //    which cross-site attackers cannot set — no CSRF risk.)
  const accessToken = getAccessTokenFromCookies(req);
  if (!accessToken) return next();

  // Enforce double-submit.
  const headerValue = req.headers?.['x-csrf-token'];
  const cookieValue = getCsrfTokenFromCookies(req);

  if (!verifyCsrfToken(headerValue, cookieValue)) {
    return res.status(403).json({
      error: {
        code: 'INVALID_CSRF_TOKEN',
        message: 'CSRF token missing or invalid',
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  return next();
}
