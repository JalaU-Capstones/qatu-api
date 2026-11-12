import { describe, it, expect } from 'vitest';
import { Product } from '../entities/Product.js';

describe('Product Entity', () => {
  const fullParams = {
    id: '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c',
    seller_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    category_id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Ergonomic office chair',
    slug: 'ergonomic-office-chair',
    description: 'High quality ergonomic mesh chair with adjustable lumbar support.',
    price: 129.99,
    currency: 'USD',
    stock: 25,
    attributes: { color: 'black', material: 'mesh' },
    primary_image_path: 'product-images/chair-front.webp',
    state: 'published',
    average_rating: 4.8,
    ratings_count: 12,
    published_at: '2026-10-10T14:30:00.000Z',
    created_at: '2026-10-09T08:00:00.000Z',
    updated_at: '2026-10-10T14:30:00.000Z',
  };

  it('should instantiate with full fields and expose snake_case properties', () => {
    const product = new Product(fullParams);

    expect(product.id).toBe(fullParams.id);
    expect(product.seller_id).toBe(fullParams.seller_id);
    expect(product.category_id).toBe(fullParams.category_id);
    expect(product.name).toBe(fullParams.name);
    expect(product.slug).toBe(fullParams.slug);
    expect(product.description).toBe(fullParams.description);
    expect(product.price).toBe(129.99);
    expect(product.currency).toBe('USD');
    expect(product.stock).toBe(25);
    expect(product.attributes).toEqual({ color: 'black', material: 'mesh' });
    expect(product.primary_image_path).toBe(fullParams.primary_image_path);
    expect(product.state).toBe('published');
    expect(product.average_rating).toBe(4.8);
    expect(product.ratings_count).toBe(12);
    expect(product.published_at).toBeInstanceOf(Date);
    expect(product.created_at).toBeInstanceOf(Date);
    expect(product.updated_at).toBeInstanceOf(Date);
  });

  it('should default attributes to {} when null or undefined', () => {
    const productNullAttrs = new Product({
      ...fullParams,
      attributes: null,
    });
    expect(productNullAttrs.attributes).toEqual({});
    expect(productNullAttrs.toJSON().attributes).toEqual({});

    const productUndefinedAttrs = new Product({
      ...fullParams,
      attributes: undefined,
    });
    expect(productUndefinedAttrs.attributes).toEqual({});
    expect(productUndefinedAttrs.toJSON().attributes).toEqual({});
  });

  it('should return all snake_case fields matching the OpenAPI contract in toJSON()', () => {
    const product = new Product(fullParams);
    const json = product.toJSON();

    expect(json).toEqual({
      id: '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c',
      seller_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      category_id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      name: 'Ergonomic office chair',
      slug: 'ergonomic-office-chair',
      description: 'High quality ergonomic mesh chair with adjustable lumbar support.',
      price: 129.99,
      currency: 'USD',
      stock: 25,
      attributes: { color: 'black', material: 'mesh' },
      primary_image_path: 'product-images/chair-front.webp',
      state: 'published',
      average_rating: 4.8,
      ratings_count: 12,
      published_at: '2026-10-10T14:30:00.000Z',
      created_at: '2026-10-09T08:00:00.000Z',
      updated_at: '2026-10-10T14:30:00.000Z',
    });
  });

  it('should normalize timestamps to ISO 8601 strings in toJSON()', () => {
    const date = new Date('2026-10-15T12:00:00.000Z');
    const product = new Product({
      ...fullParams,
      published_at: date,
      created_at: date,
      updated_at: date,
    });

    const json = product.toJSON();
    expect(json.published_at).toBe('2026-10-15T12:00:00.000Z');
    expect(json.created_at).toBe('2026-10-15T12:00:00.000Z');
    expect(json.updated_at).toBe('2026-10-15T12:00:00.000Z');
  });

  it('should return null for missing optional fields in toJSON()', () => {
    const minimalProduct = new Product({
      id: '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c',
      seller_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      name: 'Minimal Product',
      slug: 'minimal-product',
      price: 10,
    });

    const json = minimalProduct.toJSON();
    expect(json.category_id).toBeNull();
    expect(json.primary_image_path).toBeNull();
    expect(json.description).toBeNull();
    expect(json.published_at).toBeNull();
    expect(json.attributes).toEqual({});
  });

  it('should accept camelCase constructor parameters as alternatives', () => {
    const product = new Product({
      id: 'uuid-1',
      sellerId: 'seller-1',
      categoryId: 'cat-1',
      name: 'Camel Test',
      slug: 'camel-test',
      price: '50.5',
      stock: '10',
      primaryImagePath: 'img.png',
      averageRating: '4.2',
      ratingsCount: '5',
      publishedAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(product.seller_id).toBe('seller-1');
    expect(product.category_id).toBe('cat-1');
    expect(product.price).toBe(50.5);
    expect(product.stock).toBe(10);
    expect(product.primary_image_path).toBe('img.png');
    expect(product.average_rating).toBe(4.2);
    expect(product.ratings_count).toBe(5);
  });
});
