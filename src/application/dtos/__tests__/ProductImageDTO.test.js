import { describe, expect, it } from 'vitest';
import { ProductImageDTO } from '../ProductImageDTO.js';

describe('ProductImageDTO', () => {
  it('resolves relative path with bucket prefix to a full URL', () => {
    const dto = new ProductImageDTO({
      id: 'img-1',
      product_id: 'prod-1',
      path: 'product-images/u/f.webp',
      alt_text: 'Sample',
      position: 1,
      created_at: '2026-11-14T12:00:00.000Z',
    });

    const json = dto.toJSON();
    expect(json.path).toMatch(/^https?:\/\/.+\/product-images\/u\/f\.webp$/);
  });

  it('preserves null alt_text', () => {
    const dto = new ProductImageDTO({
      id: 'img-1',
      product_id: 'prod-1',
      path: 'product-images/u/f.webp',
      alt_text: null,
      position: 0,
      created_at: '2026-11-14T12:00:00.000Z',
    });

    const json = dto.toJSON();
    expect(json.alt_text).toBeNull();
  });

  it('coerces position to Number', () => {
    const dto1 = new ProductImageDTO({ position: '3' });
    expect(dto1.toJSON().position).toBe(3);

    const dto2 = new ProductImageDTO({ position: undefined });
    expect(dto2.toJSON().position).toBe(0);
  });

  it('preserves created_at ISO string', () => {
    const isoString = '2026-11-14T12:00:00.000Z';
    const dto = new ProductImageDTO({
      created_at: isoString,
    });

    expect(dto.toJSON().created_at).toBe(isoString);
  });
});
