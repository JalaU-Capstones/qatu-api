import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setSessionCookies,
  clearSessionCookies,
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  getCsrfTokenFromCookies,
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_CSRF_TOKEN,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  CSRF_TOKEN_TTL_MS,
} from '../cookieHelper.js';

function fakeRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe('cookieHelper', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('constants', () => {
    it('exposes the exact cookie names from the OpenAPI contract', () => {
      expect(COOKIE_ACCESS_TOKEN).toBe('access_token');
      expect(COOKIE_REFRESH_TOKEN).toBe('refresh_token');
      expect(COOKIE_CSRF_TOKEN).toBe('csrf_token');
    });

    it('exposes TTLs matching Supabase (1h access, 30d refresh)', () => {
      expect(ACCESS_TOKEN_TTL_MS).toBe(3_600_000);
      expect(REFRESH_TOKEN_TTL_MS).toBe(2_592_000_000);
      expect(CSRF_TOKEN_TTL_MS).toBe(ACCESS_TOKEN_TTL_MS);
    });
  });

  describe('setSessionCookies', () => {
    it('sets exactly three cookies', () => {
      const res = fakeRes();
      setSessionCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
      expect(res.cookie).toHaveBeenCalledTimes(3);
    });

    it('sets access_token with HttpOnly, Strict, Path=/, and 1h Max-Age', () => {
      const res = fakeRes();
      setSessionCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
      const [name, value, opts] = res.cookie.mock.calls[0];
      expect(name).toBe(COOKIE_ACCESS_TOKEN);
      expect(value).toBe('a');
      expect(opts).toMatchObject({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: ACCESS_TOKEN_TTL_MS,
        secure: false, // NODE_ENV=test
      });
      expect(opts.domain).toBeUndefined();
    });

    it('sets refresh_token with HttpOnly, Strict, Path=/, and 30d Max-Age', () => {
      const res = fakeRes();
      setSessionCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
      const [name, value, opts] = res.cookie.mock.calls[1];
      expect(name).toBe(COOKIE_REFRESH_TOKEN);
      expect(value).toBe('r');
      expect(opts).toMatchObject({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: REFRESH_TOKEN_TTL_MS,
      });
    });

    it('sets csrf_token with httpOnly: false (must be readable by JS)', () => {
      const res = fakeRes();
      setSessionCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
      const [name, value, opts] = res.cookie.mock.calls[2];
      expect(name).toBe(COOKIE_CSRF_TOKEN);
      expect(value).toBe('c');
      expect(opts).toMatchObject({
        httpOnly: false,
        sameSite: 'strict',
        path: '/',
        maxAge: CSRF_TOKEN_TTL_MS,
      });
    });

    it('sets Secure when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const res = fakeRes();
      setSessionCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
      expect(res.cookie.mock.calls[0][2].secure).toBe(true);
    });
  });

  describe('clearSessionCookies', () => {
    it('calls clearCookie for all three cookies', () => {
      const res = fakeRes();
      clearSessionCookies(res);
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      const names = res.clearCookie.mock.calls.map((c) => c[0]);
      expect(names).toEqual([COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_CSRF_TOKEN]);
    });

    it('passes consistent options (same path/sameSite) so browsers actually clear', () => {
      const res = fakeRes();
      clearSessionCookies(res);
      res.clearCookie.mock.calls.forEach(([, opts]) => {
        expect(opts).toMatchObject({ sameSite: 'strict', path: '/' });
      });
    });
  });

  describe('getters', () => {
    it('getAccessTokenFromCookies returns the cookie value or null', () => {
      expect(getAccessTokenFromCookies({ cookies: { access_token: 'x' } })).toBe('x');
      expect(getAccessTokenFromCookies({ cookies: {} })).toBeNull();
      expect(getAccessTokenFromCookies({})).toBeNull();
      expect(getAccessTokenFromCookies(undefined)).toBeNull();
    });

    it('getRefreshTokenFromCookies returns the cookie value or null', () => {
      expect(getRefreshTokenFromCookies({ cookies: { refresh_token: 'x' } })).toBe('x');
      expect(getRefreshTokenFromCookies({ cookies: {} })).toBeNull();
    });

    it('getCsrfTokenFromCookies returns the cookie value or null', () => {
      expect(getCsrfTokenFromCookies({ cookies: { csrf_token: 'x' } })).toBe('x');
      expect(getCsrfTokenFromCookies({ cookies: {} })).toBeNull();
    });
  });
});
