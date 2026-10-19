import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category } from '../../../../domain/entities/Category.js';
import { ICategoryRepository } from '../../../../domain/repositories/ICategoryRepository.js';
import { CategoryRepository } from '../CategoryRepository.js';

describe('CategoryRepository (unit)', () => {
  let mockDb;
  let repository;

  const sampleRow = {
    id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Gadgets',
    parent_id: null,
    position: 1,
    is_active: true,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockDb = { query: vi.fn() };
    repository = new CategoryRepository({ db: mockDb });
  });

  it('should initialize with default sequelize instance when no db is passed', () => {
    expect(new CategoryRepository().db).toBeDefined();
  });

  describe('toDomain', () => {
    it('should map a row to a Category entity', () => {
      const entity = repository.toDomain(sampleRow);
      expect(entity).toBeInstanceOf(Category);
      expect(entity.slug).toBe('electronics');
      expect(entity.is_active).toBe(true);
    });

    it('should return null for a missing row', () => {
      expect(repository.toDomain(null)).toBeNull();
      expect(repository.toDomain(undefined)).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should only query active categories ordered by position and name', async () => {
      mockDb.query.mockResolvedValueOnce([[{ total: '1' }]]).mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.findAll({ page: 1, limit: 20 });

      const sqls = mockDb.query.mock.calls.map(([sql]) => sql);
      expect(sqls.every((sql) => sql.includes('c.is_active = true'))).toBe(true);
      expect(sqls.some((sql) => sql.includes('ORDER BY c.position ASC, c.name ASC'))).toBe(true);
      expect(result.total).toBe(1);
      expect(result.items[0]).toBeInstanceOf(Category);
    });

    it('should compute the offset from page and limit', async () => {
      mockDb.query.mockResolvedValueOnce([[{ total: '45' }]]).mockResolvedValueOnce([[]]);

      await repository.findAll({ page: 3, limit: 10 });

      const pageCall = mockDb.query.mock.calls.find(([sql]) => sql.includes('LIMIT :limit'));
      expect(pageCall[1].replacements).toEqual({ limit: 10, offset: 20 });
    });

    it('should keep the real total for out-of-range pages', async () => {
      mockDb.query.mockResolvedValueOnce([[{ total: '5' }]]).mockResolvedValueOnce([[]]);

      const result = await repository.findAll({ page: 99, limit: 20 });

      expect(result).toEqual({ items: [], total: 5 });
    });

    it('should return an empty result when there are no categories', async () => {
      mockDb.query.mockResolvedValueOnce([[{ total: '0' }]]).mockResolvedValueOnce([[]]);

      expect(await repository.findAll()).toEqual({ items: [], total: 0 });
    });

    it('should tolerate unexpected query result shapes', async () => {
      mockDb.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

      expect(await repository.findAll()).toEqual({ items: [], total: 0 });
    });
  });

  describe('ICategoryRepository interface', () => {
    it('should throw Method not implemented when calling findAll', async () => {
      await expect(new ICategoryRepository().findAll({})).rejects.toThrow('Method not implemented');
    });
  });
});
