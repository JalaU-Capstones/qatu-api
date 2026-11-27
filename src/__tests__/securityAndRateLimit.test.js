import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

function createStubRoutes() {
  const publicRouter = Router();
  publicRouter.get('/', (_req, res) => res.status(200).json({ data: [] }));

  const authRouter = Router();
  authRouter.post('/login', (_req, res) => res.status(200).json({ data: { ok: true } }));

  const privateRouter = Router();
  privateRouter.get('/', (_req, res) => res.status(200).json({ data: [] }));

  return { publicRouter, authRouter, privateRouter };
}

describe('US-26: Rate Limiting and Secure Headers', () => {
  it('Scenario: Security headers present on any API response', async () => {
    const { publicRouter } = createStubRoutes();
    const app = createApp({ categoryRoutes: publicRouter });

    const res = await request(app).get('/v1/categories');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('Scenario: Rate limit exceeded after 100 requests/min on a public endpoint', async () => {
    const { publicRouter } = createStubRoutes();
    const app = createApp({ categoryRoutes: publicRouter });

    for (let i = 0; i < 100; i += 1) {
      const res = await request(app).get('/v1/categories');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('100');
    }

    const blocked = await request(app).get('/v1/categories');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['x-ratelimit-limit']).toBe('100');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['x-ratelimit-reset']).toBeDefined();
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('applies 10 req/min on auth endpoints and 1000 req/min on authenticated endpoints', async () => {
    const { authRouter, privateRouter } = createStubRoutes();
    const app = createApp({
      authRoutes: authRouter,
      cartRoutes: privateRouter,
    });

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/v1/auth/login').send({});
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('10');
    }

    const blockedAuth = await request(app).post('/v1/auth/login').send({});
    expect(blockedAuth.status).toBe(429);

    const cartRes = await request(app).get('/v1/cart');
    expect(cartRes.status).toBe(200);
    expect(cartRes.headers['x-ratelimit-limit']).toBe('1000');
  });
});
