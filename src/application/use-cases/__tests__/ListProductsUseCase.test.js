import { describe, it, expect, vi } from 'vitest';
import { Product } from '../../../domain/entities/Product.js';
import { ListProductsRequestDTO } from '../../dtos/ProductListDTO.js';
import { ListProductsUseCase } from '../ListProductsUseCase.js';

describe('ListProductsUseCase', () => {
  it('should throw an error when productRepository is missing', () => {
    expect(() => new ListProductsUseCase()).toThrow('productRepository is required');
    expect(() => new ListProductsUseCase({})).toThrow('productRepository is required');
  });

  it('should call productRepository.findAll with the correct params from requestDto', async () => {
    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const useCase = new ListProductsUseCase({ productRepository: mockRepo });

    const requestDto = new ListProductsRequestDTO({
      page: 2,
      limit: 10,
      search: 'desk',
      category_id: 'cat-123',
      min_price: 100,
      max_price: 500,
      seller_id: 'seller-789',
      sort_by: 'price',
      sort_order: 'asc',
    });

    await useCase.execute(requestDto);

    expect(mockRepo.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      filters: {
        search: 'desk',
        categoryId: 'cat-123',
        minPrice: 100,
        maxPrice: 500,
        sellerId: 'seller-789',
      },
      sort: {
        field: 'price',
        order: 'asc',
      },
    });
  });

  it('should return meta.total_pages as 0 when total === 0', async () => {
    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const useCase = new ListProductsUseCase({ productRepository: mockRepo });
    const requestDto = new ListProductsRequestDTO({ page: 1, limit: 20 });

    const result = await useCase.execute(requestDto);

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 1,
      per_page: 20,
      total: 0,
      total_pages: 0,
    });
  });

  it('should compute meta.total_pages correctly for total=25, limit=20 -> 2', async () => {
    const sampleProduct = new Product({
      id: 'p-1',
      seller_id: 's-1',
      name: 'Test Product',
      slug: 'test-product',
      price: 20,
    });

    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({ items: [sampleProduct], total: 25 }),
    };
    const useCase = new ListProductsUseCase({ productRepository: mockRepo });
    const requestDto = new ListProductsRequestDTO({ page: 1, limit: 20 });

    const result = await useCase.execute(requestDto);

    expect(result.meta).toEqual({
      page: 1,
      per_page: 20,
      total: 25,
      total_pages: 2,
    });
  });

  it('should map entities through ProductListItemDTO', async () => {
    const sampleProduct1 = new Product({
      id: 'p-1',
      seller_id: 's-1',
      name: 'Product 1',
      slug: 'product-1',
      price: 15.5,
      attributes: { color: 'red' },
    });
    const sampleProduct2 = new Product({
      id: 'p-2',
      seller_id: 's-2',
      name: 'Product 2',
      slug: 'product-2',
      price: 25.0,
      attributes: null,
    });

    const mockRepo = {
      findAll: vi.fn().mockResolvedValue({
        items: [sampleProduct1, sampleProduct2],
        total: 2,
      }),
    };
    const useCase = new ListProductsUseCase({ productRepository: mockRepo });
    const requestDto = new ListProductsRequestDTO();

    const result = await useCase.execute(requestDto);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      id: 'p-1',
      name: 'Product 1',
      price: 15.5,
      attributes: { color: 'red' },
    });
    expect(result.data[1]).toMatchObject({
      id: 'p-2',
      name: 'Product 2',
      price: 25.0,
      attributes: {},
    });
  });

  it('should propagate repository errors', async () => {
    const mockRepo = {
      findAll: vi.fn().mockRejectedValue(new Error('Database query failed')),
    };
    const useCase = new ListProductsUseCase({ productRepository: mockRepo });
    const requestDto = new ListProductsRequestDTO();

    await expect(useCase.execute(requestDto)).rejects.toThrow('Database query failed');
  });
});
