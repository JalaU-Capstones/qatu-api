import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createAuthenticatedLimiter,
  createAuthLimiter,
  createPublicLimiter,
  createRateLimiter,
  createRefreshLimiter,
  oauthExchangeLimiter,
  RATE_LIMITS,
} from '../rateLimiter.js';

function buildTestApp(limiter, path = '/test') {
  const app = express();
  app.get(path, limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post(path, limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('rateLimiter middleware', () => {
  it('exposes the expected rate limit constants from US-26', () => {
    expect(RATE_LIMITS.AUTH_MAX).toBe(10);
    expect(RATE_LIMITS.AUTH_WINDOW_MS).toBe(60_000);
    expect(RATE_LIMITS.PUBLIC_MAX).toBe(100);
    expect(RATE_LIMITS.PUBLIC_WINDOW_MS).toBe(60_000);
    expect(RATE_LIMITS.AUTHENTICATED_MAX).toBe(1000);
    expect(RATE_LIMITS.AUTHENTICATED_WINDOW_MS).toBe(60_000);
  });

  it('sets X-RateLimit-* headers and returns 429 when limit is exceeded', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const app = buildTestApp(limiter);

    const first = await request(app).get('/test');
    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-remaining']).toBe('1');
    expect(first.headers['x-ratelimit-reset']).toBeDefined();

    const second = await request(app).get('/test');
    expect(second.status).toBe(200);
    expect(second.headers['x-ratelimit-remaining']).toBe('0');

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['x-ratelimit-limit']).toBe('2');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests from this IP. Please try again after 1 minute.',
        details: [],
      },
      meta: {
        timestamp: expect.any(String),
      },
    });
  });

  it('enforces 10 req/min on auth limiter and skips /refresh and /me', async () => {
    const app = express();
    const authLimiter = createAuthLimiter();
    app.post('/login', authLimiter, (_req, res) => res.json({ ok: true }));
    app.post('/refresh', authLimiter, (_req, res) => res.json({ ok: true }));
    app.get('/me', authLimiter, (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/login');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('10');
    }

    const eleventh = await request(app).post('/login');
    expect(eleventh.status).toBe(429);

    const refreshRes = await request(app).post('/refresh');
    expect(refreshRes.status).toBe(200);

    const meRes = await request(app).get('/me');
    expect(meRes.status).toBe(200);
  });

  it('configures public (100/min), authenticated (1000/min), and refresh (100/min) limiters', async () => {
    const publicRes = await request(buildTestApp(createPublicLimiter())).get('/test');
    expect(publicRes.headers['x-ratelimit-limit']).toBe('100');

    const authRes = await request(buildTestApp(createAuthenticatedLimiter())).get('/test');
    expect(authRes.headers['x-ratelimit-limit']).toBe('1000');

    const refreshRes = await request(buildTestApp(createRefreshLimiter())).post('/test');
    expect(refreshRes.headers['x-ratelimit-limit']).toBe('100');

    expect(typeof oauthExchangeLimiter).toBe('function');
  });
});
