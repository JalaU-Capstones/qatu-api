import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCorsMiddleware } from '../corsMiddleware.js';

describe('corsMiddleware', () => {
  it('should allow requests from configured allowed origins', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
    });

    const req = {
      headers: {
        origin: 'http://localhost:5173',
      },
      method: 'GET',
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should allow requests with no origin (e.g. mobile apps or server-to-server)', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:5173'],
    });

    const req = {
      headers: {},
      method: 'GET',
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should block requests from unauthorized origins', () => {
    const middleware = createCorsMiddleware({
      allowedOrigins: ['http://localhost:5173'],
    });

    const req = {
      headers: {
        origin: 'http://malicious-site.com',
      },
      method: 'GET',
    };
    const res = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('CORS preflight (OPTIONS)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(createCorsMiddleware({ allowedOrigins: ['http://localhost:5173'] }));
    app.post('/v1/cart/items', (req, res) => res.json({ ok: true }));
    app.patch('/v1/products/:id', (req, res) => res.json({ ok: true }));
    app.delete('/v1/products/:id', (req, res) => res.json({ ok: true }));
  });

  it('preflight for POST with X-CSRF-Token returns Access-Control-Allow-Headers including x-csrf-token', async () => {
    const res = await request(app)
      .options('/v1/cart/items')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token');

    expect(res.status).toBe(204);
    const allowed = res.headers['access-control-allow-headers'] || '';
    // Header names are case-insensitive; normalize before assertion.
    const normalized = allowed
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    expect(normalized).toContain('x-csrf-token');
    expect(normalized).toContain('content-type');
  });

  it('preflight for PATCH with Authorization + X-CSRF-Token passes both headers', async () => {
    const res = await request(app)
      .options('/v1/products/xyz')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-csrf-token');

    expect(res.status).toBe(204);
    const allowed = (res.headers['access-control-allow-headers'] || '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    expect(allowed).toContain('authorization');
    expect(allowed).toContain('x-csrf-token');
  });

  it('preflight for DELETE with X-CSRF-Token is allowed', async () => {
    const res = await request(app)
      .options('/v1/products/xyz')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'x-csrf-token');

    expect(res.status).toBe(204);
    const allowed = (res.headers['access-control-allow-headers'] || '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    expect(allowed).toContain('x-csrf-token');
  });

  it('preflight from a disallowed origin does NOT return the allow-origin header', async () => {
    const res = await request(app)
      .options('/v1/cart/items')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token');

    // The `origin` callback returns an Error for disallowed origins; the exact
    // status depends on how cors() handles it. What matters is that
    // Access-Control-Allow-Origin is either absent or not equal to evil.example.com.
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
  });
});
