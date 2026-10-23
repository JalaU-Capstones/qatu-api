import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Product } from '../../../../domain/entities/Product.js';
import { IProductRepository } from '../../../../domain/repositories/IProductRepository.js';
import { ProductRepository, escapeLikePattern } from '../ProductRepository.js';

describe('escapeLikePattern', () => {
  it('should escape percent, underscore and backslash', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('should leave regular text untouched', () => {
    expect(escapeLikePattern('smartphone 5G')).toBe('smartphone 5G');
  });
});

describe('ProductRepository (unit)', () => {
  let mockDb;
  let repository;

  const sampleDbRow = {
    id: '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c',
    seller_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    category_id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Ergonomic office chair',
    slug: 'ergonomic-office-chair',
    description: 'High quality ergonomic mesh chair.',
    price: '129.99',
    currency: 'USD',
    stock: 25,
    attributes: { color: 'black' },
    primary_image_path: 'product-images/chair-front.webp',
    state: 'published',
    average_rating: '4.80',
    ratings_count: 12,
    published_at: '2026-10-10T14:30:00.000Z',
    created_at: '2026-10-09T08:00:00.000Z',
    updated_at: '2026-10-10T14:30:00.000Z',
    total_count: '1',
  };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    repository = new ProductRepository({ db: mockDb });
  });

  describe('constructor', () => {
    it('should initialize with default sequelize instance when no db is passed', () => {
      const repo = new ProductRepository();
      expect(repo.db).toBeDefined();
    });
  });

  describe('toDomain', () => {
    it('should map a database row to a Product entity', () => {
      const entity = repository.toDomain(sampleDbRow);

      expect(entity).toBeInstanceOf(Product);
      expect(entity.id).toBe(sampleDbRow.id);
      expect(entity.seller_id).toBe(sampleDbRow.seller_id);
      expect(entity.category_id).toBe(sampleDbRow.category_id);
      expect(entity.name).toBe(sampleDbRow.name);
      expect(entity.price).toBe(129.99);
      expect(entity.average_rating).toBe(4.8);
      expect(entity.attributes).toEqual({ color: 'black' });
    });

    it('should parse string attributes into an object', () => {
      const entity = repository.toDomain({
        ...sampleDbRow,
        attributes: '{"material": "mesh"}',
      });
      expect(entity.attributes).toEqual({ material: 'mesh' });
    });

    it('should return null when row is null or undefined', () => {
      expect(repository.toDomain(null)).toBeNull();
      expect(repository.toDomain(undefined)).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should generate SQL with mandatory conditions and default pagination', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({ page: 1, limit: 20 });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql, options] = mockDb.query.mock.calls[0];

      expect(sql).toContain("p.state = 'published'");
      expect(sql).toContain('p.deleted_at IS NULL');
      expect(sql).toContain('COUNT(*) OVER()');
      expect(sql).toContain('LIMIT :limit');
      expect(sql).toContain('OFFSET :offset');
      expect(options.replacements).toMatchObject({
        limit: 20,
        offset: 0,
      });
    });

    it('should assert search filter uses plainto_tsquery with the :search placeholder', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: { search: 'ergonomic chair' },
      });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain("p.search_vector @@ plainto_tsquery('simple', :search)");
      expect(options.replacements.search).toBe('ergonomic chair');
    });

    it('should also match partial words on name and description with ILIKE', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: { search: '  phone ' },
      });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('p.name ILIKE :searchPattern');
      expect(sql).toContain('p.description ILIKE :searchPattern');
      expect(options.replacements.search).toBe('phone');
      expect(options.replacements.searchPattern).toBe('%phone%');
    });

    it('should wrap the full-text and ILIKE conditions in parentheses so other filters still AND', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: { search: 'phone', categoryId: 'cat-uuid-1', minPrice: 100, maxPrice: 500 },
      });

      const [sql] = mockDb.query.mock.calls[0];
      expect(sql).toMatch(
        /\(p\.search_vector @@ plainto_tsquery\('simple', :search\) OR p\.name ILIKE :searchPattern OR p\.description ILIKE :searchPattern\)/
      );
      expect(sql).toContain('p.category_id = :categoryId');
      expect(sql).toContain('p.price >= :minPrice');
      expect(sql).toContain('p.price <= :maxPrice');
    });

    it('should bind a SQL injection attempt as data and never interpolate it into the query', async () => {
      const payload = "'; DROP TABLE products;--";
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({ filters: { search: payload } });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).toContain(':search');
      expect(sql).toContain(':searchPattern');
      expect(options.replacements.search).toBe(payload);
      expect(options.replacements.searchPattern).toBe(`%${escapeLikePattern(payload)}%`);
    });

    it('should escape LIKE wildcards so user input is matched literally', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: { search: '100%_off\\' },
      });

      const [, options] = mockDb.query.mock.calls[0];
      expect(options.replacements.searchPattern).toBe('%100\\%\\_off\\\\%');
    });

    it('should skip the search conditions when the search term is blank', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({ filters: { search: '   ' } });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).not.toContain('ILIKE');
      expect(sql).not.toContain('plainto_tsquery');
      expect(options.replacements.searchPattern).toBeUndefined();
    });

    it('should assert category_id, min_price, max_price, seller_id placeholders when provided', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: {
          categoryId: 'cat-uuid-1',
          minPrice: 50,
          maxPrice: 200,
          sellerId: 'seller-uuid-1',
        },
      });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('p.category_id = :categoryId');
      expect(sql).toContain('p.price >= :minPrice');
      expect(sql).toContain('p.price <= :maxPrice');
      expect(sql).toContain('p.seller_id = :sellerId');

      expect(options.replacements).toMatchObject({
        categoryId: 'cat-uuid-1',
        minPrice: 50,
        maxPrice: 200,
        sellerId: 'seller-uuid-1',
      });
    });

    it('should also accept snake_case filter keys', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        filters: {
          category_id: 'cat-uuid-2',
          min_price: 30,
          max_price: 150,
          seller_id: 'seller-uuid-2',
        },
      });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('p.category_id = :categoryId');
      expect(sql).toContain('p.price >= :minPrice');
      expect(sql).toContain('p.price <= :maxPrice');
      expect(sql).toContain('p.seller_id = :sellerId');
      expect(options.replacements.categoryId).toBe('cat-uuid-2');
      expect(options.replacements.minPrice).toBe(30);
      expect(options.replacements.maxPrice).toBe(150);
      expect(options.replacements.sellerId).toBe('seller-uuid-2');
    });

    it('should assert sort whitelist: unsupported sort.field falls back to created_at', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        sort: { field: 'DROP TABLE products; --', order: 'asc' },
      });

      const [sql] = mockDb.query.mock.calls[0];
      expect(sql).toContain('ORDER BY p.created_at DESC, p.id DESC');
    });

    it('should support whitelisted sort fields: price, name, average_rating', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      await repository.findAll({
        sort: { field: 'price', order: 'desc' },
      });
      expect(mockDb.query.mock.calls[0][0]).toContain('ORDER BY p.price DESC, p.id DESC');

      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);
      await repository.findAll({
        sort: { field: 'name', order: 'asc' },
      });
      expect(mockDb.query.mock.calls[1][0]).toContain('ORDER BY p.name ASC, p.id DESC');

      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);
      await repository.findAll({
        sort: { field: 'average_rating', order: 'desc' },
      });
      expect(mockDb.query.mock.calls[2][0]).toContain('ORDER BY p.average_rating DESC, p.id DESC');
    });

    it('should parse total as a number from string total_count', async () => {
      mockDb.query.mockResolvedValueOnce([[{ ...sampleDbRow, total_count: '42' }]]);

      const result = await repository.findAll();

      expect(typeof result.total).toBe('number');
      expect(result.total).toBe(42);
    });

    it('should assert empty result returns { items: [], total: 0 }', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      const result = await repository.findAll();

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should assert rows are mapped to Product instances', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      const result = await repository.findAll();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Product);
      expect(result.items[0].id).toBe(sampleDbRow.id);
    });
  });

  describe('IProductRepository Interface', () => {
    it('should throw Method not implemented when calling findAll', async () => {
      const iRepo = new IProductRepository();
      await expect(iRepo.findAll({})).rejects.toThrow('Method not implemented');
    });
  });
});
