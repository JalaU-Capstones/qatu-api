import crypto from 'node:crypto';

/**
 * Length in bytes of the generated CSRF token (32 bytes → 64 hex chars).
 * Must match `minLength: 32` in `components/parameters/csrf-token.yaml`
 * (the schema checks the min length of the *header value*, and the hex
 * representation is always double the byte count).
 */
const CSRF_TOKEN_BYTES = 32;

/**
 * Generates a new CSRF token. Cryptographically random — never deterministic.
 *
 * @returns {string} 64-character hex string.
 */
export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}

/**
 * Verifies that a `X-CSRF-Token` header value matches the `csrf_token` cookie
 * using a constant-time comparison (prevents timing attacks).
 *
 * Returns `false` when either value is missing or when the lengths differ
 * (a fast-path rejection that does NOT leak timing information — the length
 * check is on the length itself, not on the contents).
 *
 * @param {string|null|undefined} headerValue  `req.headers['x-csrf-token']`
 * @param {string|null|undefined} cookieValue  `req.cookies.csrf_token`
 * @returns {boolean}
 */
export function verifyCsrfToken(headerValue, cookieValue) {
  if (!headerValue || !cookieValue) return false;
  if (typeof headerValue !== 'string' || typeof cookieValue !== 'string') return false;

  const headerBuf = Buffer.from(headerValue, 'utf8');
  const cookieBuf = Buffer.from(cookieValue, 'utf8');

  // Comparison throws if lengths differ; guard explicitly.
  // Length mismatch is not a secret (an attacker can guess length from
  // observing their own requests), so this early return is safe.
  if (headerBuf.length !== cookieBuf.length) return false;

  return crypto.timingSafeEqual(headerBuf, cookieBuf);
}
