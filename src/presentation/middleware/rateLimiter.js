/* global setInterval */
/**
 * In-memory sliding-window rate limiter.
 *
 * MVP-adequate for single-process deployments (Render free tier). NOT safe
 * for horizontal scaling — replace with `express-rate-limit` + Redis in Phase 3
 * if the API is deployed on multiple instances.
 *
 * Uses a simple Map<key, { count, resetAt }> with a periodic cleanup sweep.
 * Trade-off: unauthenticated attackers can still cause minor memory growth
 * within the window, bounded by the maxKeys guard.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 10,
  keyGenerator = (req) => req.ip,
  maxKeys = 10_000,
} = {}) {
  const store = new Map();

  // Sweep expired entries every windowMs so the Map does not grow unbounded.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, windowMs);
  // Do not keep the Node process alive solely for this interval.
  if (typeof sweep.unref === 'function') sweep.unref();

  function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = keyGenerator(req);
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      if (store.size >= maxKeys) {
        // Bounded memory: evict oldest to make room.
        const firstKey = store.keys().next().value;
        store.delete(firstKey);
      }
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
          details: [],
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    return next();
  }

  rateLimiter.reset = () => store.clear();

  return rateLimiter;
}

/**
 * Dedicated limiter for POST /v1/auth/oauth/exchange.
 * 10 requests per minute per IP, per ADR-013.
 */
export const oauthExchangeLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
});
