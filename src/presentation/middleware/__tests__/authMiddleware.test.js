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

describe('authMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('exports requireAuth alias pointing to authMiddleware', () => {
    expect(requireAuth).toBe(authMiddleware);
  });

  it('returns 401 with generic message when Authorization header is missing', async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'Basic some-credentials';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is empty', async () => {
    req.headers.authorization = 'Bearer    ';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns 401 when supabase.auth.getUser returns an error', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid' },
    });
    req.headers.authorization = 'Bearer invalid-token';

    await authMiddleware(req, res, next);

    expect(supabase.auth.getUser).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when supabase.auth.getUser throws an error', async () => {
    supabase.auth.getUser.mockRejectedValueOnce(new Error('Network error'));
    req.headers.authorization = 'Bearer throw-token';

    await authMiddleware(req, res, next);

    expect(supabase.auth.getUser).toHaveBeenCalledWith('throw-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next() when token is valid with user_metadata.role', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          email: 'buyer@example.com',
          role: 'authenticated',
          user_metadata: { role: 'buyer' },
        },
      },
      error: null,
    });
    req.headers.authorization = 'Bearer valid-supabase-token';

    await authMiddleware(req, res, next);

    expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-supabase-token');
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      role: 'buyer',
    });
  });

  it('attaches req.user and falls back to user.role when user_metadata.role is missing', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          email: 'user@example.com',
          role: 'authenticated',
          user_metadata: {},
        },
      },
      error: null,
    });
    req.headers.authorization = 'Bearer valid-supabase-token-fallback';

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'user@example.com',
      role: 'authenticated',
    });
  });
});
