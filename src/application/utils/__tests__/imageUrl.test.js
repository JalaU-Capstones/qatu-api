import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../infrastructure/config/env.js';
import { resolveImageUrl } from '../imageUrl.js';

vi.mock('../../../infrastructure/config/env.js', () => ({
  env: {
    SUPABASE_STORAGE_PUBLIC_URL: 'http://localhost:54321/storage/v1/object/public',
    PUBLIC_APP_URL: '',
  },
}));

describe('resolveImageUrl', () => {
  const originalPublicAppUrl = env.PUBLIC_APP_URL;
  const originalStorageUrl = env.SUPABASE_STORAGE_PUBLIC_URL;

  beforeEach(() => {
    env.PUBLIC_APP_URL = '';
    env.SUPABASE_STORAGE_PUBLIC_URL = 'http://localhost:54321/storage/v1/object/public';
  });

  afterEach(() => {
    env.PUBLIC_APP_URL = originalPublicAppUrl;
    env.SUPABASE_STORAGE_PUBLIC_URL = originalStorageUrl;
  });

  it('1. returns null for null', () => {
    expect(resolveImageUrl(null, 'avatars')).toBeNull();
  });

  it('2. returns null for empty string', () => {
    expect(resolveImageUrl('', 'avatars')).toBeNull();
    expect(resolveImageUrl('   ', 'avatars')).toBeNull();
    expect(resolveImageUrl(undefined, 'avatars')).toBeNull();
  });

  it('3. returns http:// URL as-is', () => {
    expect(resolveImageUrl('http://x/y', 'avatars')).toBe('http://x/y');
  });

  it('4. returns https:// URL as-is', () => {
    expect(resolveImageUrl('https://x/y', 'avatars')).toBe('https://x/y');
  });

  it('5. resolves path with existing bucket prefix', () => {
    expect(resolveImageUrl('avatars/abc/file.png', 'avatars')).toBe(
      'http://localhost:54321/storage/v1/object/public/avatars/abc/file.png'
    );
  });

  it('6. resolves path without bucket prefix by prepending bucket', () => {
    expect(resolveImageUrl('abc/file.png', 'avatars')).toBe(
      'http://localhost:54321/storage/v1/object/public/avatars/abc/file.png'
    );
  });

  it('7. uses PUBLIC_APP_URL when set', () => {
    env.PUBLIC_APP_URL = 'http://app.local';
    expect(resolveImageUrl('avatars/abc/f.png', 'avatars')).toBe(
      'http://app.local/avatars/abc/f.png'
    );
  });

  it('handles trailing slash on base URL gracefully', () => {
    env.PUBLIC_APP_URL = 'http://app.local///';
    expect(resolveImageUrl('avatars/abc/f.png', 'avatars')).toBe(
      'http://app.local/avatars/abc/f.png'
    );
  });

  it('returns null gracefully if both env bases are missing', () => {
    env.PUBLIC_APP_URL = '';
    env.SUPABASE_STORAGE_PUBLIC_URL = '';
    expect(resolveImageUrl('avatars/abc/f.png', 'avatars')).toBeNull();
  });

  it('returns null for a non-string value', () => {
    expect(resolveImageUrl(42, 'avatars')).toBeNull();
    expect(resolveImageUrl({}, 'avatars')).toBeNull();
  });

  it('resolves a path without a bucket by joining it directly to the base', () => {
    expect(resolveImageUrl('files/report.pdf')).toBe(
      'http://localhost:54321/storage/v1/object/public/files/report.pdf'
    );
    expect(resolveImageUrl('/files/report.pdf')).toBe(
      'http://localhost:54321/storage/v1/object/public/files/report.pdf'
    );
  });
});
