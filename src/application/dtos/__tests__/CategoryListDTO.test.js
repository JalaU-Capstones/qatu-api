import { describe, it, expect } from 'vitest';
import { Category } from '../../../domain/entities/Category.js';
import { CategoryListItemDTO, ListCategoriesRequestDTO } from '../CategoryListDTO.js';

describe('ListCategoriesRequestDTO', () => {
  it('should default to page 1 and limit 20', () => {
    const dto = new ListCategoriesRequestDTO();
    expect(dto.toRepositoryParams()).toEqual({ page: 1, limit: 20 });
  });

  it('should coerce string values to numbers', () => {
    const dto = new ListCategoriesRequestDTO({ page: '3', limit: '50' });
    expect(dto.toRepositoryParams()).toEqual({ page: 3, limit: 50 });
  });

  it('should fall back to defaults for empty or null values', () => {
    const dto = new ListCategoriesRequestDTO({ page: '', limit: null });
    expect(dto.toRepositoryParams()).toEqual({ page: 1, limit: 20 });
  });
});

describe('CategoryListItemDTO', () => {
  it('should throw when category is missing', () => {
    expect(() => new CategoryListItemDTO()).toThrow('Category entity is required');
  });

  it('should map a Category entity to the contract shape', () => {
    const category = new Category({
      id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      name: 'Books',
      slug: 'books',
      position: 5,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    });

    expect(new CategoryListItemDTO(category).toJSON()).toEqual({
      id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      name: 'Books',
      slug: 'books',
      description: null,
      parent_id: null,
      position: 5,
      is_active: true,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
  });

  it('should accept a plain object without toJSON', () => {
    const dto = new CategoryListItemDTO({ id: 'c1', name: 'Sports', slug: 'sports' });
    expect(dto.toJSON()).toMatchObject({ id: 'c1', name: 'Sports', description: null });
  });
});
