import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../authMiddleware.js';

describe('authMiddleware', () => {
  const secret = 'super-secret-supabase-jwt-key';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    vi.clearAllMocks();
  });

  it('allows to continue and adds req.user if JWT is valid', () => {
    const payload = { sub: 'b78a9c20-7212-4c28-98f2-d4b3ff255b08', role: 'authenticated', email: 'test@qatu.com' };
    const token = jwt.sign(payload, secret);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    });
  });

  it('returns 401 if Authorization header is not sent', () => {
    const req = { headers: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if token is signed with another secret password', () => {
    const token = jwt.sign({ sub: '123' }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});