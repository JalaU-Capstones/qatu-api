import { describe, it, expect, vi } from 'vitest';
import { Product } from '../../../domain/entities/Product.js';
import { ListSellerProductsUseCase } from '../ListSellerProductsUseCase.js';

describe('ListSellerProductsUseCase', () => {
  it('returns paginated seller product data', async () => {
    const product = new Product({
      id: 'p-1',
      seller_id: 'seller-123',
      name: 'Desk Lamp',
      slug: 'desk-lamp',
      price: 29.99,
      currency: 'USD',
      stock: 5,
      attributes: { color: 'black' },
      state: 'published',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const mockRepo = {
      listBySeller: vi.fn().mockResolvedValue({ items: [product], total: 1, page: 2, limit: 10 }),
    };

    const useCase = new ListSellerProductsUseCase({ productRepository: mockRepo });
    const result = await useCase.execute('seller-123', { page: 2, limit: 10 });

    expect(mockRepo.listBySeller).toHaveBeenCalledWith('seller-123', {
      page: 2,
      limit: 10,
      status: undefined,
    });
    expect(result).toMatchObject({
      data: [expect.objectContaining({ id: 'p-1', name: 'Desk Lamp' })],
      meta: {
        page: 2,
        per_page: 10,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('passes the status filter through to the repository', async () => {
    const mockRepo = {
      listBySeller: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    };

    const useCase = new ListSellerProductsUseCase({ productRepository: mockRepo });
    await useCase.execute('seller-123', { page: 1, limit: 20, status: 'draft' });

    expect(mockRepo.listBySeller).toHaveBeenCalledWith('seller-123', {
      page: 1,
      limit: 20,
      status: 'draft',
    });
  });

  it('caps limit at 100', async () => {
    const mockRepo = {
      listBySeller: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 }),
    };

    const useCase = new ListSellerProductsUseCase({ productRepository: mockRepo });
    await useCase.execute('seller-123', { page: 1, limit: 999 });

    expect(mockRepo.listBySeller).toHaveBeenCalledWith('seller-123', {
      page: 1,
      limit: 100,
      status: undefined,
    });
  });

  it('defaults page to 1 and limit to 20', async () => {
    const mockRepo = {
      listBySeller: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    };

    const useCase = new ListSellerProductsUseCase({ productRepository: mockRepo });
    await useCase.execute('seller-123');

    expect(mockRepo.listBySeller).toHaveBeenCalledWith('seller-123', {
      page: 1,
      limit: 20,
      status: undefined,
    });
  });

  it('throws a 400 VALIDATION_ERROR when sellerId is missing', async () => {
    const mockRepo = {
      listBySeller: vi.fn(),
    };

    const useCase = new ListSellerProductsUseCase({ productRepository: mockRepo });

    await expect(useCase.execute(undefined, { page: 1, limit: 20 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
