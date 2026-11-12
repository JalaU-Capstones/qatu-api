import { beforeEach, describe, expect, it, vi } from 'vitest';
import { csrfMiddleware } from '../csrfMiddleware.js';

function fakeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('csrfMiddleware', () => {
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    res = fakeRes();
    next = vi.fn();
  });

  describe('skip rules', () => {
    it('skips GET requests', () => {
      const req = { method: 'GET', path: '/v1/cart/items' };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('skips HEAD requests', () => {
      const req = { method: 'HEAD', path: '/v1/cart/items' };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips OPTIONS requests', () => {
      const req = { method: 'OPTIONS', path: '/v1/cart/items' };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips POST /v1/auth/login (exempt per contract)', () => {
      const req = {
        method: 'POST',
        path: '/v1/auth/login',
        cookies: { access_token: 'any' },
        headers: {},
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips POST /v1/auth/register', () => {
      const req = {
        method: 'POST',
        path: '/v1/auth/register',
        cookies: { access_token: 'any' },
        headers: {},
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips POST /v1/auth/refresh', () => {
      const req = {
        method: 'POST',
        path: '/v1/auth/refresh',
        cookies: { access_token: 'any' },
        headers: {},
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips POST /v1/auth/logout', () => {
      const req = {
        method: 'POST',
        path: '/v1/auth/logout',
        cookies: { access_token: 'any' },
        headers: {},
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('skips POST with no access_token cookie (Bearer-only or unauthenticated)', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        cookies: {}, // no access_token
        headers: { authorization: 'Bearer bearer-token' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('skips POST when req.cookies is undefined', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        headers: { authorization: 'Bearer bearer-token' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('enforcement (cookie-authed mutating requests)', () => {
    it('returns 403 INVALID_CSRF_TOKEN when X-CSRF-Token header is missing', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: {},
      };
      csrfMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_CSRF_TOKEN' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when X-CSRF-Token does not match csrf_token cookie', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: { 'x-csrf-token': 'csrf-DIFFERENT' },
      };
      csrfMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 when csrf_token cookie is missing', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        cookies: { access_token: 'a' }, // no csrf_token
        headers: { 'x-csrf-token': 'csrf-abc' },
      };
      csrfMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('passes when X-CSRF-Token matches csrf_token cookie (POST)', () => {
      const req = {
        method: 'POST',
        path: '/v1/cart/items',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: { 'x-csrf-token': 'csrf-abc' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('passes when X-CSRF-Token matches csrf_token cookie (PATCH)', () => {
      const req = {
        method: 'PATCH',
        path: '/v1/cart/items/xyz',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: { 'x-csrf-token': 'csrf-abc' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('passes when X-CSRF-Token matches csrf_token cookie (PUT)', () => {
      const req = {
        method: 'PUT',
        path: '/v1/products/xyz',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: { 'x-csrf-token': 'csrf-abc' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('passes when X-CSRF-Token matches csrf_token cookie (DELETE)', () => {
      const req = {
        method: 'DELETE',
        path: '/v1/products/xyz',
        cookies: { access_token: 'a', csrf_token: 'csrf-abc' },
        headers: { 'x-csrf-token': 'csrf-abc' },
      };
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
