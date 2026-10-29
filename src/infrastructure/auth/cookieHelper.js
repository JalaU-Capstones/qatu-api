import { env } from '../config/env.js';

/**
 * Cookie names as defined by the OpenAPI contract
 * (`components/securitySchemes/cookieAuth.yaml`).
 * Do NOT change these names — the frontend and Swagger UI both depend on them.
 */
export const COOKIE_ACCESS_TOKEN = 'access_token';
export const COOKIE_REFRESH_TOKEN = 'refresh_token';
export const COOKIE_CSRF_TOKEN = 'csrf_token';

/**
 * Max-Age in milliseconds. Matches the Supabase Auth TTLs (ADR-012):
 *  - access token: 1 hour
 *  - refresh token: 30 days
 *  - csrf token: 1 hour (rotated alongside the access token)
 */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 3_600_000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000
export const CSRF_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_MS;

/**
 * Common cookie flags per ADR-012. `secure` is toggled by NODE_ENV to keep
 * local HTTP dev working (Secure cookies are rejected over HTTP).
 */
function baseCookieOptions() {
  return {
    secure: (process.env.NODE_ENV || env.NODE_ENV) === 'production',
    sameSite: 'strict',
    path: '/',
    // domain is intentionally NOT set — defaults to the current host.
    // See ADR-012 §"Decision scope and implementation".
  };
}

/**
 * Sets the three session cookies on the response.
 *
 * - `access_token`  → HttpOnly, 1h
 * - `refresh_token` → HttpOnly, 30d
 * - `csrf_token`    → NOT HttpOnly (the frontend must read it and echo it
 *                      in the `X-CSRF-Token` header on state-changing requests).
 *
 * @param {import('express').Response} res
 * @param {Object} session
 * @param {string} session.accessToken  Supabase JWT access token.
 * @param {string} session.refreshToken Supabase refresh token (UUID).
 * @param {string} session.csrfToken    Random hex (32 bytes) for double-submit CSRF.
 */
export function setSessionCookies(res, { accessToken, refreshToken, csrfToken }) {
  const base = baseCookieOptions();

  res.cookie(COOKIE_ACCESS_TOKEN, accessToken, {
    ...base,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_TTL_MS,
  });

  res.cookie(COOKIE_REFRESH_TOKEN, refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });

  res.cookie(COOKIE_CSRF_TOKEN, csrfToken, {
    ...base,
    httpOnly: false, // must be readable by the frontend
    maxAge: CSRF_TOKEN_TTL_MS,
  });
}

/**
 * Clears the three session cookies (idempotent — safe to call even when
 * cookies are absent). Matches the Set-Cookie: <name>=; Max-Age=0 pattern
 * documented in `paths/auth.yaml#/logout`.
 *
 * @param {import('express').Response} res
 */
export function clearSessionCookies(res) {
  const base = baseCookieOptions();

  res.clearCookie(COOKIE_ACCESS_TOKEN, { ...base, httpOnly: true });
  res.clearCookie(COOKIE_REFRESH_TOKEN, { ...base, httpOnly: true });
  res.clearCookie(COOKIE_CSRF_TOKEN, { ...base, httpOnly: false });
}

/**
 * Reads the access token from a request's cookies (HttpOnly cookie).
 * Returns `null` if the cookie is missing.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getAccessTokenFromCookies(req) {
  return req?.cookies?.[COOKIE_ACCESS_TOKEN] || null;
}

/**
 * Reads the refresh token from a request's cookies.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getRefreshTokenFromCookies(req) {
  return req?.cookies?.[COOKIE_REFRESH_TOKEN] || null;
}

/**
 * Reads the CSRF cookie value (readable by the browser; used for double-submit).
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getCsrfTokenFromCookies(req) {
  return req?.cookies?.[COOKIE_CSRF_TOKEN] || null;
}
