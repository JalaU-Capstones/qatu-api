import rateLimit from 'express-rate-limit';

export const RATE_LIMITS = Object.freeze({
  AUTH_WINDOW_MS: 60 * 1000,
  AUTH_MAX: 10,
  PUBLIC_WINDOW_MS: 60 * 1000,
  PUBLIC_MAX: 100,
  AUTHENTICATED_WINDOW_MS: 60 * 1000,
  AUTHENTICATED_MAX: 1000,
  REFRESH_WINDOW_MS: 60 * 1000,
  REFRESH_MAX: 100,
});

function buildRateLimitMessage(message) {
  return () => ({
    error: {
      code: 'TOO_MANY_REQUESTS',
      message,
      details: [],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Factory backed by `express-rate-limit` that emits both `X-RateLimit-*`
 * (legacyHeaders) and IETF `RateLimit-*` (standardHeaders) headers.
 */
export function createRateLimiter({
  windowMs = RATE_LIMITS.PUBLIC_WINDOW_MS,
  max = RATE_LIMITS.PUBLIC_MAX,
  message = 'Too many requests from this IP. Please try again after 1 minute.',
  skip,
  keyGenerator,
} = {}) {
  const options = {
    windowMs,
    max,
    message: typeof message === 'function' ? message : buildRateLimitMessage(message),
    standardHeaders: true,
    legacyHeaders: true,
    ...(skip ? { skip } : {}),
    ...(keyGenerator ? { keyGenerator } : {}),
  };

  return rateLimit(options);
}

/**
 * Auth endpoints: 10 requests per minute per IP.
 * Skips `/refresh` (100 req/min per ADR-012) and authenticated `/me` and `/password`
 * (handled by the authenticated tier).
 */
export function createAuthLimiter() {
  return createRateLimiter({
    windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
    max: RATE_LIMITS.AUTH_MAX,
    skip: (req) =>
      req.path === '/refresh' ||
      req.path === '/me' ||
      req.path === '/password' ||
      req.path === '/oauth/exchange',
    message: 'Too many authentication requests from this IP. Please try again after 1 minute.',
  });
}

/**
 * Public endpoints: 100 requests per minute per IP.
 */
export function createPublicLimiter() {
  const max = process.env.PUBLIC_RATE_LIMIT_MAX
    ? Number(process.env.PUBLIC_RATE_LIMIT_MAX)
    : RATE_LIMITS.PUBLIC_MAX;

  return createRateLimiter({
    windowMs: RATE_LIMITS.PUBLIC_WINDOW_MS,
    max,
    message: 'Too many requests from this IP. Please try again after 1 minute.',
  });
}
/**
 * Authenticated endpoints: 1000 requests per minute.
 */
export function createAuthenticatedLimiter() {
  return createRateLimiter({
    windowMs: RATE_LIMITS.AUTHENTICATED_WINDOW_MS,
    max: RATE_LIMITS.AUTHENTICATED_MAX,
    message: 'Too many authenticated requests. Please try again after 1 minute.',
  });
}

/**
 * Session refresh endpoint: 100 requests per minute per IP (ADR-012).
 */
export function createRefreshLimiter() {
  return createRateLimiter({
    windowMs: RATE_LIMITS.REFRESH_WINDOW_MS,
    max: RATE_LIMITS.REFRESH_MAX,
    message: 'Too many refresh requests from this IP. Please try again after 1 minute.',
  });
}

/**
 * Dedicated limiter for POST /v1/auth/oauth/exchange: 10 requests per minute per IP (ADR-013).
 */
export const oauthExchangeLimiter = createRateLimiter({
  windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
  max: RATE_LIMITS.AUTH_MAX,
  message: 'Too many OAuth exchange requests from this IP. Please try again after 1 minute.',
});
