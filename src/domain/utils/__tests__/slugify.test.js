import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify.js';

describe('slugify', () => {
  it('converts a standard product name into a clean slug', () => {
    expect(slugify('Wireless Noise-Canceling Headphones')).toBe(
      'wireless-noise-canceling-headphones'
    );
  });

  it('strips diacritics and lowercases accented text', () => {
    expect(slugify('Ñandú Café 2026')).toBe('nandu-cafe-2026');
  });

  it('falls back to product when the input only contains separators', () => {
    expect(slugify('  ---  ')).toBe('product');
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugify('  Foam   &   Steel---Chair  ')).toBe('foam-steel-chair');
  });

  it('caps the slug at 100 characters', () => {
    const longText = 'a'.repeat(200);
    const result = slugify(longText);

    expect(result.length).toBe(100);
    expect(result).toBe('a'.repeat(100));
  });

  it('keeps the final slug at a word boundary when truncating', () => {
    const longText =
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega';
    const result = slugify(longText);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('-')).toBe(false);
  });
});
