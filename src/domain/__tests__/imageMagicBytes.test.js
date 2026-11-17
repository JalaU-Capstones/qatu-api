import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_FORMATS,
  detectImageFormat,
  detectImageMimeType,
} from '../utils/imageMagicBytes.js';

// ─── Helper buffers ─────────────────────────────────────────────────────────

/** Minimal valid JPEG (SOI + APP0 marker start). */
const JPEG_BUF = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

/** Full 8-byte PNG magic. */
const PNG_BUF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

/** Minimal 12-byte WebP container: "RIFF" + 4-byte size (all zeros) + "WEBP". */
const WEBP_BUF = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

/** ZIP local-file header magic (should NOT be detected as an image). */
const ZIP_BUF = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

/** Arbitrary non-image bytes. */
const RANDOM_BUF = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
]);

// ─── ALLOWED_IMAGE_FORMATS ───────────────────────────────────────────────────

describe('ALLOWED_IMAGE_FORMATS', () => {
  it('is ["jpeg", "png", "webp"]', () => {
    expect(ALLOWED_IMAGE_FORMATS).toEqual(['jpeg', 'png', 'webp']);
  });

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(ALLOWED_IMAGE_FORMATS)).toBe(true);
  });
});

// ─── detectImageFormat ───────────────────────────────────────────────────────

describe('detectImageFormat', () => {
  it('detects JPEG from FF D8 FF magic bytes', () => {
    expect(detectImageFormat(JPEG_BUF)).toBe('jpeg');
  });

  it('detects PNG from 89 50 4E 47 0D 0A 1A 0A magic bytes', () => {
    expect(detectImageFormat(PNG_BUF)).toBe('png');
  });

  it('detects WebP from RIFF...WEBP container magic', () => {
    expect(detectImageFormat(WEBP_BUF)).toBe('webp');
  });

  it('returns null for a ZIP file (PK\x03\x04)', () => {
    expect(detectImageFormat(ZIP_BUF)).toBeNull();
  });

  it('returns null for arbitrary non-image bytes', () => {
    expect(detectImageFormat(RANDOM_BUF)).toBeNull();
  });

  it('returns null for an empty Buffer', () => {
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for a Buffer with only 2 bytes (too short for any magic)', () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('returns null for a non-Buffer string', () => {
    // @ts-expect-error intentional wrong type
    expect(detectImageFormat('fake-image')).toBeNull();
  });

  it('returns null for null', () => {
    // @ts-expect-error intentional wrong type
    expect(detectImageFormat(null)).toBeNull();
  });

  it('returns null for a WebP-like buffer that is only 11 bytes (incomplete RIFF header)', () => {
    const truncatedWebp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00]),
      Buffer.from('WEB'), // only 11 bytes total — missing the final 'P'
    ]);
    expect(detectImageFormat(truncatedWebp)).toBeNull();
  });
});

// ─── detectImageMimeType ─────────────────────────────────────────────────────

describe('detectImageMimeType', () => {
  it('returns "image/jpeg" for a JPEG buffer', () => {
    expect(detectImageMimeType(JPEG_BUF)).toBe('image/jpeg');
  });

  it('returns "image/png" for a PNG buffer', () => {
    expect(detectImageMimeType(PNG_BUF)).toBe('image/png');
  });

  it('returns "image/webp" for a WebP buffer', () => {
    expect(detectImageMimeType(WEBP_BUF)).toBe('image/webp');
  });

  it('returns null for an unknown format', () => {
    expect(detectImageMimeType(ZIP_BUF)).toBeNull();
  });

  it('returns null for a non-Buffer', () => {
    // @ts-expect-error intentional wrong type
    expect(detectImageMimeType('not-a-buffer')).toBeNull();
  });
});
