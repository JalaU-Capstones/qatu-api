/**
 * Converts arbitrary text into a URL-safe slug.
 *
 * Rules (stable, tested):
 *   - Lowercase
 *   - Unicode NFD normalize + strip diacritics (á→a, ñ→n)
 *   - Whitespace and any non-alphanumeric → hyphen
 *   - Collapse consecutive hyphens
 *   - Trim leading/trailing hyphens
 *   - Cap at 100 characters (at a word boundary if possible)
 *   - Empty result → fallback 'product'
 *
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  const raw = typeof text === 'string' ? text : String(text ?? '');

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return 'product';
  }

  if (slug.length > 100) {
    const boundary = slug.lastIndexOf('-', 100);
    slug = boundary > 0 ? slug.slice(0, boundary) : slug.slice(0, 100);
    slug = slug.replace(/-+$/g, '');
  }

  return slug || 'product';
}
