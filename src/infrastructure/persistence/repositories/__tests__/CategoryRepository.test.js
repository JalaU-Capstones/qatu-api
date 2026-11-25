import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category } from '../../../../domain/entities/Category.js';
import { ICategoryRepository } from '../../../../domain/repositories/ICategoryRepository.js';
import { CategoryRepository } from '../CategoryRepository.js';

describe('CategoryRepository (unit)', () => {
  let mockDb;
  let repository;

  const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  const PARENT_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';

  const sampleRow = {
    id: CATEGORY_ID,
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

  describe('findById', () => {
    it('should return a Category entity when the row exists', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.findById(CATEGORY_ID);

      expect(result).toBeInstanceOf(Category);
      expect(result.id).toBe(CATEGORY_ID);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE c.id = :id'), {
        replacements: { id: CATEGORY_ID },
      });
    });

    it('should return null when no row matches', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      expect(await repository.findById(CATEGORY_ID)).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should look up a category case-insensitively by name', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.findByName('Electronics');

      expect(result).toBeInstanceOf(Category);
      expect(result.name).toBe('Electronics');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(c.name) = LOWER(:name)'),
        { replacements: { name: 'Electronics' } }
      );
    });

    it('should return null when the name is not found', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      expect(await repository.findByName('Missing')).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should look up a category by slug', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.findBySlug('electronics');

      expect(result).toBeInstanceOf(Category);
      expect(result.slug).toBe('electronics');
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE c.slug = :slug'), {
        replacements: { slug: 'electronics' },
      });
    });

    it('should return null when the slug is not found', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      expect(await repository.findBySlug('missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('should insert a category with default position and is_active values', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.create({ name: 'Electronics', slug: 'electronics' });

      expect(result).toBeInstanceOf(Category);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.categories'),
        {
          replacements: {
            name: 'Electronics',
            slug: 'electronics',
            description: null,
            parent_id: null,
            position: 0,
            is_active: true,
          },
        }
      );
    });

    it('should forward explicit optional fields', async () => {
      mockDb.query.mockResolvedValueOnce([
        [{ ...sampleRow, parent_id: PARENT_ID, position: 3, is_active: false }],
      ]);

      await repository.create({
        name: 'Laptops',
        slug: 'laptops',
        description: 'Portable computers',
        parent_id: PARENT_ID,
        position: 3,
        is_active: false,
      });

      expect(mockDb.query.mock.calls[0][1].replacements).toEqual({
        name: 'Laptops',
        slug: 'laptops',
        description: 'Portable computers',
        parent_id: PARENT_ID,
        position: 3,
        is_active: false,
      });
    });

    it('should map a PostgreSQL unique violation (23505) to 409 CONFLICT', async () => {
      const pgError = new Error('duplicate key value violates unique constraint');
      pgError.parent = { code: '23505' };
      mockDb.query.mockRejectedValueOnce(pgError);

      await expect(
        repository.create({ name: 'Electronics', slug: 'electronics' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'A category with this name or slug already exists',
      });
    });

    it('should map a unique violation reported through error.original', async () => {
      const pgError = new Error('duplicate key value violates unique constraint');
      pgError.original = { code: '23505' };
      mockDb.query.mockRejectedValueOnce(pgError);

      await expect(
        repository.create({ name: 'Electronics', slug: 'electronics' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    });

    it('should rethrow non-unique database errors unchanged', async () => {
      const boom = new Error('connection lost');
      mockDb.query.mockRejectedValueOnce(boom);

      await expect(repository.create({ name: 'Electronics', slug: 'electronics' })).rejects.toBe(
        boom
      );
    });
  });

  describe('update', () => {
    it('should update only the allowed fields that were provided', async () => {
      mockDb.query.mockResolvedValueOnce([[{ ...sampleRow, name: 'Consumer Electronics' }]]);

      const result = await repository.update(CATEGORY_ID, {
        name: 'Consumer Electronics',
        description: 'Consumer gadgets',
        ignored: 'not-a-column',
      });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('UPDATE public.categories');
      expect(sql).toContain('name = :name');
      expect(sql).toContain('description = :description');
      expect(sql).not.toContain('ignored');
      expect(options.replacements).toEqual({
        id: CATEGORY_ID,
        name: 'Consumer Electronics',
        description: 'Consumer gadgets',
      });
      expect(result).toBeInstanceOf(Category);
      expect(result.name).toBe('Consumer Electronics');
    });

    it('should return the current category when there are no fields to update', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleRow]]);

      const result = await repository.update(CATEGORY_ID, {});

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query.mock.calls[0][0]).toContain('SELECT');
      expect(result).toBeInstanceOf(Category);
      expect(result.id).toBe(CATEGORY_ID);
    });

    it('should map a PostgreSQL unique violation (23505) to 409 CONFLICT', async () => {
      const pgError = new Error('duplicate key value violates unique constraint');
      pgError.parent = { code: '23505' };
      mockDb.query.mockRejectedValueOnce(pgError);

      await expect(repository.update(CATEGORY_ID, { slug: 'electronics' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
    });
  });

  describe('hasProducts', () => {
    it('should return true when the category has non-deleted products', async () => {
      mockDb.query.mockResolvedValueOnce([[{ found: 1 }]]);

      const result = await repository.hasProducts(CATEGORY_ID);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.category_id = :id AND p.deleted_at IS NULL'),
        { replacements: { id: CATEGORY_ID } }
      );
    });

    it('should return false when the category has no products', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      expect(await repository.hasProducts(CATEGORY_ID)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should return true when a row was deleted', async () => {
      mockDb.query.mockResolvedValueOnce([[{ id: CATEGORY_ID }]]);

      const result = await repository.delete(CATEGORY_ID);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.categories'),
        { replacements: { id: CATEGORY_ID } }
      );
    });

    it('should return false when no row was deleted', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      expect(await repository.delete(CATEGORY_ID)).toBe(false);
    });
  });

  describe('defensive result handling', () => {
    it('normalizes null description and invalid pagination', async () => {
      const category = repository.toDomain({ ...sampleRow, description: null });
      expect(category.description).toBeNull();

      mockDb.query.mockResolvedValueOnce([[{ total: '2' }]]).mockResolvedValueOnce([[sampleRow]]);
      await repository.findAll({ page: 'bad', limit: 0 });

      expect(mockDb.query.mock.calls[1][1].replacements).toEqual({ limit: 20, offset: 0 });
    });

    it('tolerates undefined query results in single-row lookups', async () => {
      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.findById(CATEGORY_ID)).resolves.toBeNull();

      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.findByName('Electronics')).resolves.toBeNull();

      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.findBySlug('electronics')).resolves.toBeNull();
    });

    it('returns null when create or update returns an empty row', async () => {
      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.create({ name: 'X', slug: 'x' })).resolves.toBeNull();

      mockDb.query.mockResolvedValueOnce([[null]]);
      await expect(repository.create({ name: 'X', slug: 'x' })).resolves.toBeNull();

      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.update(CATEGORY_ID, { name: 'X' })).resolves.toBeNull();

      mockDb.query.mockResolvedValueOnce([[null]]);
      await expect(repository.update(CATEGORY_ID, { name: 'X' })).resolves.toBeNull();
    });

    it('tolerates undefined results in existence checks', async () => {
      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.hasProducts(CATEGORY_ID)).resolves.toBe(false);

      mockDb.query.mockResolvedValueOnce(undefined);
      await expect(repository.delete(CATEGORY_ID)).resolves.toBe(false);
    });
  });

  describe('ICategoryRepository interface', () => {
    it('should throw Method not implemented when calling findAll', async () => {
      await expect(new ICategoryRepository().findAll({})).rejects.toThrow('Method not implemented');
    });
  });
});
