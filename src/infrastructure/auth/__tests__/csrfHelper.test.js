import { describe, it, expect } from 'vitest';
import { generateCsrfToken, verifyCsrfToken } from '../csrfHelper.js';

describe('csrfHelper', () => {
  describe('generateCsrfToken', () => {
    it('returns a 64-character hex string (32 bytes)', () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different value each call', () => {
      const a = generateCsrfToken();
      const b = generateCsrfToken();
      expect(a).not.toBe(b);
    });

    it('never returns an empty or short value', () => {
      for (let i = 0; i < 10; i++) {
        expect(generateCsrfToken().length).toBeGreaterThanOrEqual(64);
      }
    });
  });

  describe('verifyCsrfToken', () => {
    it('returns true when header and cookie match', () => {
      const token = generateCsrfToken();
      expect(verifyCsrfToken(token, token)).toBe(true);
    });

    it('returns false when header and cookie differ', () => {
      const a = generateCsrfToken();
      const b = generateCsrfToken();
      expect(verifyCsrfToken(a, b)).toBe(false);
    });

    it('returns false when header is missing', () => {
      const token = generateCsrfToken();
      expect(verifyCsrfToken(undefined, token)).toBe(false);
      expect(verifyCsrfToken(null, token)).toBe(false);
      expect(verifyCsrfToken('', token)).toBe(false);
    });

    it('returns false when cookie is missing', () => {
      const token = generateCsrfToken();
      expect(verifyCsrfToken(token, undefined)).toBe(false);
      expect(verifyCsrfToken(token, null)).toBe(false);
      expect(verifyCsrfToken(token, '')).toBe(false);
    });

    it('returns false when either value is not a string', () => {
      expect(verifyCsrfToken(123, 'abc')).toBe(false);
      expect(verifyCsrfToken('abc', 123)).toBe(false);
    });

    it('returns false when lengths differ (no throw)', () => {
      expect(() => verifyCsrfToken('short', 'a-much-longer-value')).not.toThrow();
      expect(verifyCsrfToken('short', 'a-much-longer-value')).toBe(false);
    });

    it('does NOT throw for mismatched lengths (timingSafeEqual guard)', () => {
      const a = 'a'.repeat(64);
      const b = 'a'.repeat(32);
      expect(() => verifyCsrfToken(a, b)).not.toThrow();
      expect(verifyCsrfToken(a, b)).toBe(false);
    });
  });
});
