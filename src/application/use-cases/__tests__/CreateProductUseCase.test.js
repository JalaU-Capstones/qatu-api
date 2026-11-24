import { describe, it, expect, vi } from 'vitest';
import { slugify } from '../../../domain/utils/slugify.js';
import { CreateProductRequestDTO } from '../../dtos/CreateProductDTO.js';
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
      findByIdWithDetails: vi.fn().mockResolvedValue({
        ...createdRow,
        images: [
          {
            id: 'img-1',
            product_id: createdRow.id,
            path: 'product-images/x/y.png',
            alt_text: null,
            position: 0,
            created_at: '2026-11-14T12:00:00.000Z',
          },
        ],
        seller: {
          id: '00000000-0000-4000-8000-000000000002',
          username: 's',
          full_name: 'S',
          avatar_path: null,
        },
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
      }),
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
    expect(result.data.images).toHaveLength(1);
    expect(result.data.images[0].path).toContain('product-images/x/y.png');
    expect(result.data.seller).not.toBeNull();
    expect(result.data.category).not.toBeNull();
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('accepts a CreateProductRequestDTO instance', async () => {
    const createdRow = createRow();
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
      findByIdWithDetails: vi.fn().mockResolvedValue(createdRow),
    };
    const useCase = new CreateProductUseCase({ productRepository });
    const dto = new CreateProductRequestDTO({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Premium Headphones',
      slug: 'dto-slug',
    });

    await expect(useCase.execute(dto)).resolves.toMatchObject({ data: { id: createdRow.id } });
    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'dto-slug' })
    );
  });

  it('rejects an undefined dto with its own validation error', async () => {
    const productRepository = { create: vi.fn(), findByIdWithDetails: vi.fn() };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(useCase.execute()).rejects.toThrow('sellerId is required');
    expect(productRepository.create).not.toHaveBeenCalled();
  });

  it('applies currency, stock and attributes defaults and falls back to the created row', async () => {
    const createdRow = createRow({ currency: 'USD', stock: 0, attributes: {} });
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
      findByIdWithDetails: vi.fn().mockResolvedValue(null),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    const result = await useCase.execute({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Premium Headphones',
      slug: 'defaults-slug',
      currency: '',
      stock: undefined,
      attributes: undefined,
    });

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD', stock: 0, attributes: {} })
    );
    expect(result.data.id).toBe(createdRow.id);
  });

  it('accepts DTO-normalized currency and stock values without losing them', async () => {
    const createdRow = createRow({ currency: 'BOB', stock: 7, attributes: { color: 'red' } });
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
      findByIdWithDetails: vi.fn().mockResolvedValue(null),
    };
    const useCase = new CreateProductUseCase({ productRepository });
    const request = new CreateProductRequestDTO({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Premium Headphones',
      slug: 'dto-values-slug',
      price: 399.99,
      currency: 'BOB',
      stock: 7,
      attributes: { color: 'red' },
    });

    await useCase.execute(request);

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'BOB', stock: 7, attributes: { color: 'red' } })
    );
  });

  it('applies defaults when a DTO exposes falsy optional values', async () => {
    const createdRow = createRow();
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
      findByIdWithDetails: vi.fn().mockResolvedValue(null),
    };
    const useCase = new CreateProductUseCase({ productRepository });
    const request = new CreateProductRequestDTO({
      sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
      categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
      name: 'Premium Headphones',
      slug: 'falsy-values-slug',
      price: 399.99,
    });
    request.currency = '';
    request.stock = undefined;
    request.attributes = undefined;

    await useCase.execute(request);

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD', stock: 0, attributes: {} })
    );
  });

  it('throws SLUG_ALREADY_EXISTS when a unique-violation retry chain ends without an explicit throw', async () => {
    const duplicateError = Object.assign(new Error('duplicate slug'), {
      parent: { code: '23505', constraint: 'products_seller_id_slug_key' },
    });
    let reads = 0;
    const candidates = {
      0: 'base-slug',
      get length() {
        reads += 1;
        if (reads === 1) return 3;
        if (reads === 2) return 4;
        return 1;
      },
    };
    const productRepository = { create: vi.fn().mockRejectedValue(duplicateError) };
    const useCase = new CreateProductUseCase({ productRepository });
    vi.spyOn(useCase, '_buildSlugCandidates').mockReturnValue(candidates);

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Wireless Noise-Canceling Headphones',
        price: 399.99,
      })
    ).rejects.toMatchObject({ code: 'SLUG_ALREADY_EXISTS', statusCode: 409 });
  });

  it('rethrows a unique violation that is not related to the slug', async () => {
    const error = Object.assign(new Error('duplicate category'), {
      code: '23505',
      constraint: 'products_category_id_key',
    });
    const productRepository = {
      create: vi.fn().mockRejectedValue(error),
      findByIdWithDetails: vi.fn(),
    };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Premium Headphones',
      })
    ).rejects.toBe(error);
  });

  it('should auto-generate a slug when no custom slug is provided', async () => {
    const createdRow = createRow({
      slug: 'wireless-noise-canceling-headphones',
      name: 'Wireless Noise-Canceling Headphones',
    });
    const productRepository = {
      create: vi.fn().mockResolvedValue(createdRow),
      findByIdWithDetails: vi.fn().mockResolvedValue({
        ...createdRow,
        images: [],
        seller: {
          id: '00000000-0000-4000-8000-000000000002',
          username: 's',
          full_name: 'S',
          avatar_path: null,
        },
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
      }),
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
      findByIdWithDetails: vi.fn().mockResolvedValue({
        ...createdRow,
        images: [],
        seller: {
          id: '00000000-0000-4000-8000-000000000002',
          username: 's',
          full_name: 'S',
          avatar_path: null,
        },
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
      }),
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

  it('should rethrow an unexpected repository error unchanged', async () => {
    const unexpected = new Error('connection reset');
    const productRepository = { create: vi.fn().mockRejectedValue(unexpected) };
    const useCase = new CreateProductUseCase({ productRepository });

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Premium Headphones',
        price: 399.99,
      })
    ).rejects.toBe(unexpected);
  });

  it('should surface the creation failure when no slug candidates are generated', async () => {
    const productRepository = { create: vi.fn() };
    const useCase = new CreateProductUseCase({ productRepository });
    vi.spyOn(useCase, '_buildSlugCandidates').mockReturnValue([]);

    await expect(
      useCase.execute({
        sellerId: 'f1a3f2c8-bd68-4d7f-a506-5d45817d2d4b',
        categoryId: '3bb8de4a-7845-4cb8-b3ca-4c11a3908dfe',
        name: 'Premium Headphones',
        price: 399.99,
      })
    ).rejects.toThrow('Product creation failed');
    expect(productRepository.create).not.toHaveBeenCalled();
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
