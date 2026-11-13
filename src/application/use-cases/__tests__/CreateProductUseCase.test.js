import { describe, it, expect, vi } from 'vitest';
import { slugify } from '../../../domain/utils/slugify.js';
import { CreateProductUseCase } from '../CreateProductUseCase.js';

describe('CreateProductUseCase', () => {
  const createRow = (overrides = {}) => ({
    id: 'a0b7e7af-1c8d-4b22-a5ec-0d32d5e7c1d9',
    seller_id: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
    category_id: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
    name: 'Wireless Noise-Canceling Headphones',
    slug: 'wireless-noise-canceling-headphones',
    description: 'Premium wireless headphones',
    price: 399.99,
    currency: 'USD',
    stock: 25,
    attributes: { color: 'black' },
    state: 'draft',
    published_at: null,
    primary_image_path: null,
    average_rating: 0,
    ratings_count: 0,
    created_at: '2026-11-13T00:00:00.000Z',
    updated_at: '2026-11-13T00:00:00.000Z',
    ...overrides,
  });

  it('should throw when productRepository is missing', () => {
    expect(() => new CreateProductUseCase()).toThrow('productRepository is required');
  });

  it('should create a product with a client-supplied slug and return the row', async () => {
    const createdRow = createRow({ slug: 'premium-headphones' });
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    const result = await useCase.execute({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Premium Headphones',
      slug: 'premium-headphones',
      description: 'Premium wireless headphones',
      price: 399.99,
      currency: 'USD',
      stock: 25,
      attributes: { color: 'black' },
    });

    expect(productRepository.create).toHaveBeenCalledTimes(1);
    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Premium Headphones',
        slug: 'premium-headphones',
      })
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        slug: 'premium-headphones',
      })
    );
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should auto-generate a slug when no custom slug is provided', async () => {
    const createdRow = createRow({
      slug: 'wireless-noise-canceling-headphones',
      name: 'Wireless Noise-Canceling Headphones',
    });
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    const result = await useCase.execute({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Wireless Noise-Canceling Headphones',
      price: 399.99,
    });

    expect(productRepository.create).toHaveBeenCalledTimes(1);
    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: slugify('Wireless Noise-Canceling Headphones'),
      })
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        slug: slugify('Wireless Noise-Canceling Headphones'),
      })
    );
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should throw SLUG_ALREADY_EXISTS when client slug already exists', async () => {
    const uniqueError = new Error(
      'duplicate key value violates unique constraint products_seller_id_slug_key'
    );
    uniqueError.parent = { code: '23505', constraint: 'products_seller_id_slug_key' };
    const productRepository = {
      create: vi.fn().mockRejectedValue(uniqueError),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Premium Headphones',
        slug: 'premium-headphones',
        price: 399.99,
      })
    ).rejects.toMatchObject({
      code: 'SLUG_ALREADY_EXISTS',
      statusCode: 409,
      message: 'Slug already exists',
    });
    expect(productRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should retry with a numeric suffix when auto-generated slug collides', async () => {
    const duplicateError = new Error(
      'duplicate key value violates unique constraint products_seller_id_slug_key'
    );
    duplicateError.parent = { code: '23505', constraint: 'products_seller_id_slug_key' };
    const createdRow = createRow({ slug: 'wireless-noise-canceling-headphones-2' });
    const productRepository = {
      create: vi.fn().mockRejectedValueOnce(duplicateError).mockResolvedValueOnce(createdRow),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    const result = await useCase.execute({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Wireless Noise-Canceling Headphones',
      price: 399.99,
    });

    expect(productRepository.create).toHaveBeenCalledTimes(2);
    expect(productRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ slug: 'wireless-noise-canceling-headphones' })
    );
    expect(productRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ slug: 'wireless-noise-canceling-headphones-2' })
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        slug: 'wireless-noise-canceling-headphones-2',
      })
    );
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should throw SLUG_ALREADY_EXISTS after five auto-generated slug attempts', async () => {
    const duplicateError = new Error(
      'duplicate key value violates unique constraint products_seller_id_slug_key'
    );
    duplicateError.parent = { code: '23505', constraint: 'products_seller_id_slug_key' };
    const productRepository = {
      create: vi.fn().mockRejectedValue(duplicateError),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Wireless Noise-Canceling Headphones',
        price: 399.99,
      })
    ).rejects.toMatchObject({
      code: 'SLUG_ALREADY_EXISTS',
      statusCode: 409,
      message: 'Slug already exists',
    });
    expect(productRepository.create).toHaveBeenCalledTimes(5);
  });

  it('should throw VALIDATION_ERROR when sellerId is missing', async () => {
    const productRepository = {
      create: vi.fn(),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Wireless Noise-Canceling Headphones',
        price: 399.99,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'sellerId is required',
    });
  });

  it('should throw INVALID_CATEGORY when the category does not exist', async () => {
    const foreignKeyError = new Error(
      'insert or update on table "products" violates foreign key constraint'
    );
    foreignKeyError.parent = { code: '23503' };
    const productRepository = {
      create: vi.fn().mockRejectedValue(foreignKeyError),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Wireless Noise-Canceling Headphones',
        price: 399.99,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CATEGORY',
      statusCode: 422,
      message: 'Category does not exist',
    });
  });
});
