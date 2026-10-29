import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { authMiddleware, requireAuth } from '../authMiddleware.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

/**
 * Builds a minimal fake Supabase user response for `getUser`.
 */
function supabaseUser({ id = 'u-1', email = 'test@example.com', role = 'buyer' } = {}) {
  return {
    data: {
      user: {
        id,
        email,
        role: 'authenticated',
        user_metadata: { role },
      },
    },
    error: null,
  };
}

/**
 * Builds an expired JWT for testing the `REFRESH_REQUIRED` path.
 * The signature is irrelevant because the middleware calls `jwt.decode`
 * (unverified), but we still sign to keep the payload shape realistic.
 */
function expiredJwt() {
  return jwt.sign({ sub: 'u-1', exp: Math.floor(Date.now() / 1000) - 60 }, 'test-secret');
}

function fakeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('authMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {} };
    res = fakeRes();
    next = vi.fn();
  });

  describe('export alias', () => {
    it('exports requireAuth alias pointing to authMiddleware', () => {
      expect(requireAuth).toBe(authMiddleware);
    });
  });

  describe('cookie authentication (preferred)', () => {
    it('authenticates from the access_token cookie and sets authMethod="cookie"', async () => {
      supabase.auth.getUser.mockResolvedValueOnce(supabaseUser({ id: 'u-cookie' }));
      req.cookies = { access_token: 'valid-cookie-token' };

      await authMiddleware(req, res, next);

      expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-cookie-token');
      expect(req.user).toEqual({
        id: 'u-cookie',
        role: 'buyer',
        email: 'test@example.com',
      });
      expect(req.authMethod).toBe('cookie');
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('prefers cookie over Bearer when both are present', async () => {
      supabase.auth.getUser.mockResolvedValueOnce(supabaseUser({ id: 'u-cookie' }));
      req.cookies = { access_token: 'cookie-token' };
      req.headers.authorization = 'Bearer bearer-token';

      await authMiddleware(req, res, next);

      expect(supabase.auth.getUser).toHaveBeenCalledWith('cookie-token');
      expect(req.authMethod).toBe('cookie');
    });
  });

  describe('bearer fallback', () => {
    it('authenticates from the Authorization header and sets authMethod="bearer"', async () => {
      supabase.auth.getUser.mockResolvedValueOnce(supabaseUser({ id: 'u-bearer' }));
      req.headers.authorization = 'Bearer valid-bearer-token';
      req.cookies = {};

      await authMiddleware(req, res, next);

      expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-bearer-token');
      expect(req.user.id).toBe('u-bearer');
      expect(req.authMethod).toBe('bearer');
      expect(next).toHaveBeenCalledOnce();
    });

    it('treats missing Authorization header with no cookie as 401 UNAUTHORIZED', async () => {
      req.cookies = {};

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('treats "Bearer " with empty token as 401 UNAUTHORIZED', async () => {
      req.cookies = {};
      req.headers.authorization = 'Bearer ';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('treats non-Bearer Authorization (e.g. "Basic ...") as unauthenticated', async () => {
      req.cookies = {};
      req.headers.authorization = 'Basic dXNlcjpwYXNz';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });
  });

  describe('invalid / expired tokens', () => {
    it('returns 401 UNAUTHORIZED when Supabase rejects a non-expired token', async () => {
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid JWT' },
      });
      req.cookies = {};
      // A valid, non-expired JWT shape
      const validToken = jwt.sign(
        { sub: 'u-1', exp: Math.floor(Date.now() / 1000) + 600 },
        'test-secret'
      );
      req.headers.authorization = `Bearer ${validToken}`;

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });

    it('returns 401 REFRESH_REQUIRED when access token is expired AND a refresh cookie is present', async () => {
      const expired = expiredJwt();
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid JWT: token is expired' },
      });
      req.cookies = {
        access_token: expired,
        refresh_token: 'refresh-uuid',
      };

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'REFRESH_REQUIRED' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 UNAUTHORIZED when access token is expired but NO refresh cookie exists', async () => {
      const expired = expiredJwt();
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid JWT: token is expired' },
      });
      req.cookies = { access_token: expired };

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });

    it('returns 401 UNAUTHORIZED when jwt.decode throws (malformed token)', async () => {
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid' },
      });
      req.cookies = { access_token: 'not-a-jwt', refresh_token: 'r' };

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('returns 401 UNAUTHORIZED when supabase.auth.getUser throws', async () => {
      supabase.auth.getUser.mockRejectedValueOnce(new Error('network error'));
      req.headers.authorization = 'Bearer throw-token';
      req.cookies = {};

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });

    it('handles req.cookies being undefined (cookieParser not mounted)', async () => {
      supabase.auth.getUser.mockResolvedValueOnce(supabaseUser({ id: 'u-bearer' }));
      req.headers.authorization = 'Bearer bearer-token';
      // req.cookies intentionally NOT set

      await authMiddleware(req, res, next);

      expect(req.authMethod).toBe('bearer');
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
