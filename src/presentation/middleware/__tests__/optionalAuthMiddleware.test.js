import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optionalAuthMiddleware } from '../optionalAuthMiddleware.js';

const mocks = vi.hoisted(() => ({
  getAccessTokenFromCookies: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/cookieHelper.js', () => ({
  getAccessTokenFromCookies: mocks.getAccessTokenFromCookies,
}));

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: { auth: { getUser: mocks.getUser } },
}));

describe('optionalAuthMiddleware', () => {
  let req;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessTokenFromCookies.mockReturnValue(null);
    req = { headers: {} };
    next = vi.fn();
  });

  it('sets req.user to null and calls next when no token is supplied', async () => {
    await optionalAuthMiddleware(req, {}, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('uses the cookie token and populates the user from user_metadata', async () => {
    mocks.getAccessTokenFromCookies.mockReturnValue('cookie-token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u-1', email: 'a@b.com', user_metadata: { role: 'seller' } } },
      error: null,
    });

    await optionalAuthMiddleware(req, {}, next);

    expect(mocks.getUser).toHaveBeenCalledWith('cookie-token');
    expect(req.user).toEqual({ id: 'u-1', role: 'seller', email: 'a@b.com' });
    expect(req.authMethod).toBe('cookie');
  });

  it('falls back to the Bearer token and the top-level role', async () => {
    req.headers.authorization = 'Bearer bearer-token';
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u-2', role: 'buyer' } },
      error: null,
    });

    await optionalAuthMiddleware(req, {}, next);

    expect(mocks.getUser).toHaveBeenCalledWith('bearer-token');
    expect(req.user).toEqual({ id: 'u-2', role: 'buyer', email: null });
    expect(req.authMethod).toBe('bearer');
  });

  it('sets a null user when Supabase rejects the token', async () => {
    mocks.getAccessTokenFromCookies.mockReturnValue('bad-token');
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

    await optionalAuthMiddleware(req, {}, next);

    expect(req.user).toBeNull();
    expect(req.authMethod).toBeUndefined();
  });

  it('sets req.user to null and calls next when Supabase throws', async () => {
    mocks.getAccessTokenFromCookies.mockReturnValue('throwing-token');
    mocks.getUser.mockRejectedValue(new Error('network error'));

    await optionalAuthMiddleware(req, {}, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
    expect(req.authMethod).toBeUndefined();
  });

  it('tolerates a missing headers object', async () => {
    const bareReq = {};

    await optionalAuthMiddleware(bareReq, {}, next);

    expect(bareReq.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });
});
