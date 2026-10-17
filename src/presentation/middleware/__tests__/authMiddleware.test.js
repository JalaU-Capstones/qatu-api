import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware, requireAuth } from '../authMiddleware.js';

describe('authMiddleware', () => {
  const secret = 'test-secret-key';
  let req;
  let res;
  let next;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
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

  it('returns 401 with generic message when Authorization header is missing', () => {
    authMiddleware(req, res, next);

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

  it('returns 401 when Bearer token is empty', () => {
    req.headers.authorization = 'Bearer    ';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token signature is invalid', () => {
    const wrongToken = jwt.sign({ sub: 'user-123' }, 'wrong-secret', { expiresIn: '1h' });
    req.headers.authorization = `Bearer ${wrongToken}`;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired (exp <= now)', () => {
    const expiredToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'buyer@example.com',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      secret,
      { algorithm: 'HS256' }
    );
    req.headers.authorization = `Bearer ${expiredToken}`;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next() when token is valid and not expired', () => {
    const validToken = jwt.sign(
      {
        sub: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'buyer@example.com',
        role: 'authenticated',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    req.headers.authorization = `Bearer ${validToken}`;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      role: 'authenticated',
    });
  });
});
