import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateProductUseCase } from '../UpdateProductUseCase.js';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SELLER_ID = '660e8400-e29b-41d4-a716-446655440001';
const CATEGORY_ID = '770e8400-e29b-41d4-a716-446655440002';

const product = (overrides = {}) => ({
  id: PRODUCT_ID,
  seller_id: SELLER_ID,
  category_id: CATEGORY_ID,
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product',
  price: '29.99',
  currency: 'USD',
  stock: 10,
  attributes: {},
  primary_image_path: 'product-images/x/y.png',
  state: 'draft',
  average_rating: '0',
  ratings_count: 0,
  published_at: null,
  created_at: '2026-10-14T08:00:00.000Z',
  updated_at: '2026-10-14T08:00:00.000Z',
  ...overrides,
});

describe('UpdateProductUseCase', () => {
  let productRepository;
  let useCase;

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      findByIdWithDetails: vi.fn(),
    };
    useCase = new UpdateProductUseCase({ productRepository });
  });

  it('requires a productRepository', () => {
    expect(() => new UpdateProductUseCase()).toThrow('productRepository is required');
    expect(() => new UpdateProductUseCase({})).toThrow('productRepository is required');
  });

  it.each([[null], [undefined], [[]], ['name']])(
    'rejects a non-object fields value (%j)',
    async (fields) => {
      await expect(
        useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID, fields })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'At least one field is required',
      });
    }
  );

  it('rethrows an unexpected repository error unchanged', async () => {
    const unexpected = new Error('connection reset');
    productRepository.findById.mockResolvedValue(product());
    productRepository.update.mockRejectedValue(unexpected);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID, fields: { name: 'New Name' } })
    ).rejects.toBe(unexpected);
  });

  it('1. rejects a missing productId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ sellerId: SELLER_ID, fields: { name: 'New Name' } })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('2. rejects an invalid UUID productId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        productId: 'invalid-uuid',
        sellerId: SELLER_ID,
        fields: { name: 'New Name' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId must be a valid UUID',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('3. rejects a missing sellerId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ productId: PRODUCT_ID, fields: { name: 'New Name' } })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'sellerId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('4. rejects empty fields object with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID, fields: {} })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'At least one field is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('5. rejects fields containing slug with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { slug: 'custom-slug', name: 'Valid Name' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot edit field: slug',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('6. rejects fields containing state with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { state: 'published' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot edit field: state',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('7. returns 404 PRODUCT_NOT_FOUND when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { name: 'Updated Name' },
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('8. rejects updating product owned by another seller with 403 FORBIDDEN', async () => {
    productRepository.findById.mockResolvedValue(product({ seller_id: 'another-seller-uuid' }));

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { name: 'Updated Name' },
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('9. rejects editing archived product with 409 INVALID_STATE_TRANSITION', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'archived' }));

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { name: 'Updated Name' },
      })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot edit a product in state 'archived'",
    });
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('10. maps Postgres FK error (23503) to 422 INVALID_CATEGORY', async () => {
    productRepository.findById.mockResolvedValue(product());
    const fkError = new Error(
      'insert or update on table "products" violates foreign key constraint'
    );
    fkError.parent = { code: '23503' };
    productRepository.update.mockRejectedValue(fkError);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { category_id: '880e8400-e29b-41d4-a716-446655440099' },
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CATEGORY',
      statusCode: 422,
      message: 'Category does not exist',
    });
  });

  it('11. returns 404 PRODUCT_NOT_FOUND when repo update returns null (concurrency race)', async () => {
    productRepository.findById.mockResolvedValue(product());
    productRepository.update.mockResolvedValue(null);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { name: 'Updated Name' },
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('12. updates single field (price: 99.99) on draft product happy path', async () => {
    const existing = product({ price: '29.99' });
    productRepository.findById.mockResolvedValue(existing);

    const updated = {
      ...existing,
      price: '99.99',
      updated_at: '2026-10-15T12:00:00.000Z',
    };
    productRepository.update.mockResolvedValue(updated);
    productRepository.findByIdWithDetails.mockResolvedValue({
      ...updated,
      seller: { id: SELLER_ID, username: 'seller', full_name: 'Seller Name', avatar_path: null },
      category: { id: CATEGORY_ID, name: 'Electronics', slug: 'electronics' },
      images: [],
    });

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { price: 99.99 },
    });

    expect(result.data.price).toBe(99.99);
    expect(result.meta.timestamp).toEqual(expect.any(String));
    expect(productRepository.update).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { price: 99.99 },
    });
  });

  it('13. updates multiple fields (name, price) happy path', async () => {
    const existing = product();
    productRepository.findById.mockResolvedValue(existing);

    const updated = {
      ...existing,
      name: 'Super Gadget Pro',
      price: '149.50',
      updated_at: '2026-10-15T12:00:00.000Z',
    };
    productRepository.update.mockResolvedValue(updated);
    productRepository.findByIdWithDetails.mockResolvedValue({
      ...updated,
      seller: { id: SELLER_ID, username: 'seller', full_name: 'Seller Name', avatar_path: null },
      category: { id: CATEGORY_ID, name: 'Electronics', slug: 'electronics' },
      images: [],
    });

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { name: 'Super Gadget Pro', price: 149.5 },
    });

    expect(result.data.name).toBe('Super Gadget Pro');
    expect(result.data.price).toBe(149.5);
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('14. updates a published product successfully while state remains published', async () => {
    const publishedAt = '2026-10-10T10:00:00.000Z';
    const existing = product({ state: 'published', published_at: publishedAt });
    productRepository.findById.mockResolvedValue(existing);

    const updated = {
      ...existing,
      stock: 50,
      updated_at: '2026-10-15T12:00:00.000Z',
    };
    productRepository.update.mockResolvedValue(updated);
    productRepository.findByIdWithDetails.mockResolvedValue({
      ...updated,
      seller: { id: SELLER_ID, username: 'seller', full_name: 'Seller Name', avatar_path: null },
      category: { id: CATEGORY_ID, name: 'Electronics', slug: 'electronics' },
      images: [],
    });

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { stock: 50 },
    });

    expect(result.data.state).toBe('published');
    expect(result.data.published_at).toBe(publishedAt);
    expect(result.data.stock).toBe(50);
  });

  it('15. blocks currency change on a published product with 409 CANNOT_CHANGE_CURRENCY_ON_PUBLISHED', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published', currency: 'USD' }));

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { currency: 'EUR' },
      })
    ).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_CURRENCY_ON_PUBLISHED',
      statusCode: 409,
      message: 'Cannot change currency on a published product. Unpublish it first.',
    });
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('16. allows same-currency "change" on a published product (no-op guard)', async () => {
    const publishedAt = '2026-10-10T10:00:00.000Z';
    const existing = product({ state: 'published', currency: 'USD', published_at: publishedAt });
    productRepository.findById.mockResolvedValue(existing);

    const updated = {
      ...existing,
      price: '50.00',
      updated_at: '2026-10-15T12:00:00.000Z',
    };
    productRepository.update.mockResolvedValue(updated);
    productRepository.findByIdWithDetails.mockResolvedValue({
      ...updated,
      seller: { id: SELLER_ID, username: 'seller', full_name: 'Seller Name', avatar_path: null },
      category: { id: CATEGORY_ID, name: 'Electronics', slug: 'electronics' },
      images: [],
    });

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { currency: 'USD', price: 50 },
    });

    expect(result.data.currency).toBe('USD');
    expect(result.data.price).toBe(50);
    expect(productRepository.update).toHaveBeenCalledTimes(1);
  });

  it('falls back to the updated row when no detailed product is returned', async () => {
    const existing = product();
    productRepository.findById.mockResolvedValue(existing);
    const updated = { ...existing, price: '99.99' };
    productRepository.update.mockResolvedValue(updated);
    productRepository.findByIdWithDetails.mockResolvedValue(null);

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      fields: { price: 99.99 },
    });

    expect(result.data.price).toBe(99.99);
  });
});
