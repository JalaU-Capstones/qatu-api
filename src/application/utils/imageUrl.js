import { env } from '../../infrastructure/config/env.js';

/**
 * Resolves a stored image field (path or URL) to a fully-qualified URL
 * usable by clients.
 *
 * Storage convention (ADR-010 + ADR-019):
 *   - DB stores relative paths like `avatars/{userId}/{file}.webp`
 *     (with the bucket prefix) or `product-images/{productId}/{file}.webp`.
 *   - `PUBLIC_APP_URL` toggles the resolved origin:
 *       - empty/unset  → `SUPABASE_STORAGE_PUBLIC_URL` (Supabase direct URL)
 *       - set          → `${PUBLIC_APP_URL}` (SPA-origin, requires the
 *                        frontend nginx proxy from ADR-019 Phase 2)
 *
 * Behavior:
 *   - null / undefined / ''            → returns null
 *   - `http://...` or `https://...`    → returns as-is (defense; supports
 *                                        legacy DB rows and external URLs)
 *   - `${bucket}/${path}`               → `${base}/${bucket}/${path}`
 *   - anything else (no bucket prefix) → `${base}/${bucket}/${value}`
 *
 * @param {string|null|undefined} value  Raw DB field or already-resolved URL
 * @param {'avatars'|'product-images'} bucket
 * @returns {string|null}
 */
export function resolveImageUrl(value, bucket) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const publicAppUrl = (env?.PUBLIC_APP_URL || '').trim();
  const storagePublicUrl = (env?.SUPABASE_STORAGE_PUBLIC_URL || '').trim();
  const rawBase = publicAppUrl || storagePublicUrl;

  if (!rawBase) {
    return null;
  }

  const base = rawBase.replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');

  if (bucket && cleanPath.startsWith(`${bucket}/`)) {
    return `${base}/${cleanPath}`;
  }

  if (bucket) {
    return `${base}/${bucket}/${cleanPath}`;
  }

  return `${base}/${cleanPath}`;
}
