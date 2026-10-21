import { describe, it, expect, vi } from 'vitest';
import { Category } from '../../../domain/entities/Category.js';
import { ListCategoriesRequestDTO } from '../../dtos/CategoryListDTO.js';
import { ListCategoriesUseCase } from '../ListCategoriesUseCase.js';

describe('ListCategoriesUseCase', () => {
  it('should throw an error when categoryRepository is missing', () => {
    expect(() => new ListCategoriesUseCase()).toThrow('categoryRepository is required');
    expect(() => new ListCategoriesUseCase({})).toThrow('categoryRepository is required');
  });

  it('should call categoryRepository.findAll with page and limit', async () => {
    const repo = { findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    const useCase = new ListCategoriesUseCase({ categoryRepository: repo });

    await useCase.execute(new ListCategoriesRequestDTO({ page: 2, limit: 10 }));

    expect(repo.findAll).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });

  it('should return total_pages 0 when there are no categories', async () => {
    const repo = { findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    const useCase = new ListCategoriesUseCase({ categoryRepository: repo });

    const result = await useCase.execute(new ListCategoriesRequestDTO());

    expect(result).toEqual({
      data: [],
      meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
    });
  });

  it('should map entities to DTOs and compute total_pages', async () => {
    const items = [
      new Category({ id: 'c1', name: 'Electronics', slug: 'electronics', position: 1 }),
      new Category({ id: 'c2', name: 'Clothing', slug: 'clothing', position: 2 }),
    ];
    const repo = { findAll: vi.fn().mockResolvedValue({ items, total: 5 }) };
    const useCase = new ListCategoriesUseCase({ categoryRepository: repo });

    const result = await useCase.execute(new ListCategoriesRequestDTO({ page: 1, limit: 2 }));

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ id: 'c1', slug: 'electronics', is_active: true });
    expect(result.meta).toEqual({ page: 1, per_page: 2, total: 5, total_pages: 3 });
  });

  it('should propagate repository errors', async () => {
    const repo = { findAll: vi.fn().mockRejectedValue(new Error('db down')) };
    const useCase = new ListCategoriesUseCase({ categoryRepository: repo });

    await expect(useCase.execute(new ListCategoriesRequestDTO())).rejects.toThrow('db down');
  });
});
