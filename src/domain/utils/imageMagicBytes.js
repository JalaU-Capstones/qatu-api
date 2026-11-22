/**
 * Pure magic-byte (file signature) detection for image uploads.
 * No external dependencies — uses only Buffer.subarray().
 *
 * Supported formats:  JPEG · PNG · WebP
 *
 * Used by:
 *   - UploadProductImageUseCase  (application layer)
 *   - UploadAvatarUseCase        (application layer)
 *
 * @module imageMagicBytes
 */

/** Canonical format identifiers returned by detectImageFormat(). */
export const ALLOWED_IMAGE_FORMATS = Object.freeze(['jpeg', 'png', 'webp']);

/**
 * Inspects the leading bytes of a Buffer and returns the image format.
 *
 * Signature table:
 *   JPEG  — bytes 0-2  : FF D8 FF
 *   PNG   — bytes 0-7  : 89 50 4E 47 0D 0A 1A 0A
 *   WebP  — bytes 0-3  : 52 49 46 46 ("RIFF")
 *           bytes 8-11 : 57 45 42 50 ("WEBP")
 *
 * @param {Buffer} buffer - Raw file bytes.
 * @returns {'jpeg'|'png'|'webp'|null} Detected format, or null if unknown / too short.
 */
export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return null;

  // PNG — 8-byte magic (check first to avoid FF D8 FF false-positives on truncated PNGs)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP — RIFF container (12 bytes: "RIFF" + 4-byte file size + "WEBP")
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'webp';
  }

  // JPEG — SOI marker (3 bytes minimum: FF D8 FF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  return null;
}

/** @type {Readonly<Record<string, string>>} */
const FORMAT_TO_MIME = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

/**
 * Convenience wrapper — returns the MIME type string for the detected format,
 * or null when the buffer is not a recognised image.
 *
 * @param {Buffer} buffer - Raw file bytes.
 * @returns {string|null} e.g. 'image/png', or null.
 */
export function detectImageMimeType(buffer) {
  const fmt = detectImageFormat(buffer);
  // eslint-disable-next-line security/detect-object-injection
  return fmt ? (FORMAT_TO_MIME[fmt] ?? null) : null;
}
