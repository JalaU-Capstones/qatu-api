import { describe, it, expect } from 'vitest';
import { ProductDetailDTO } from '../ProductDetailDTO.js';

describe('ProductDetailDTO image resolution', () => {
  const rawProduct = {
    id: 'p1',
    seller_id: 's1',
    category_id: 'c1',
    name: 'X',
    slug: 'x',
    price: 9.99,
    currency: 'USD',
    stock: 1,
    primary_image_path: 'product-images/p1/a.webp',
    images: [
      {
        id: 'i1',
        product_id: 'p1',
        path: 'product-images/p1/a.webp',
        alt_text: null,
        position: 0,
        created_at: '2026-11-14T12:00:00.000Z',
      },
      {
        id: 'i2',
        product_id: 'p1',
        path: 'product-images/p1/b.webp',
        alt_text: 'B',
        position: 1,
        created_at: '2026-11-14T12:00:00.000Z',
      },
    ],
    seller: { id: 's1', username: 's', full_name: 'S', avatar_path: 'avatars/s1/avatar.webp' },
    category: { id: 'c1', name: 'C', slug: 'c' },
    state: 'draft',
    average_rating: 0,
    ratings_count: 0,
    published_at: null,
    created_at: '2026-11-14T12:00:00.000Z',
    updated_at: '2026-11-14T12:00:00.000Z',
  };

  it('resolves primary_image_path to a full URL', () => {
    const dto = new ProductDetailDTO(rawProduct).toJSON();
    expect(dto.primary_image_path).toMatch(/product-images\/p1\/a\.webp$/);
    expect(dto.primary_image_path).toMatch(/^http/);
  });

  it('resolves every image.path and preserves schema fields', () => {
    const dto = new ProductDetailDTO(rawProduct).toJSON();
    expect(dto.images).toHaveLength(2);
    expect(dto.images[0]).toMatchObject({
      id: 'i1',
      product_id: 'p1',
      alt_text: null,
      position: 0,
    });
    expect(dto.images[0].path).toMatch(/^http.*product-images\/p1\/a\.webp$/);
    expect(dto.images[1].path).toMatch(/^http.*product-images\/p1\/b\.webp$/);
  });

  it('resolves seller.avatar_path to a full URL', () => {
    const dto = new ProductDetailDTO(rawProduct).toJSON();
    expect(dto.seller.avatar_path).toMatch(/^http.*avatars\/s1\/avatar\.webp$/);
  });

  it('keeps null seller / category untouched', () => {
    const dto = new ProductDetailDTO({ ...rawProduct, seller: null, category: null }).toJSON();
    expect(dto.seller).toBeNull();
    expect(dto.category).toBeNull();
  });
});
