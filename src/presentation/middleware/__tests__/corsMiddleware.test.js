import { describe, it, expect, vi } from 'vitest';
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
