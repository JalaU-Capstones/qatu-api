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

  describe('findByIdWithDetails', () => {
    const productId = '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c';

    it('should execute relational query with LEFT JOINs and parse stringified JSON fields', async () => {
      const detailedDbRow = {
        ...sampleDbRow,
        attributes: '{"color":"black"}',
        seller:
          '{"id":"c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f","username":"john_seller","full_name":"John Seller"}',
        category:
          '{"id":"b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e","name":"Furniture","slug":"furniture"}',
        images: '[{"id":"img-1","path":"product-images/chair-front.webp","position":0}]',
      };

      mockDb.query.mockResolvedValueOnce([[detailedDbRow]]);

      const result = await repository.findByIdWithDetails(productId);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql, options] = mockDb.query.mock.calls[0];

      expect(sql).toContain('LEFT JOIN public.profiles prof');
      expect(sql).toContain('LEFT JOIN public.categories c');
      expect(sql).toContain('public.product_images img');
      expect(sql).toContain('p.id = :productId AND p.deleted_at IS NULL');
      expect(options.replacements).toEqual({ productId });

      expect(result).toEqual({
        ...detailedDbRow,
        attributes: { color: 'black' },
        seller: {
          id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
          username: 'john_seller',
          full_name: 'John Seller',
        },
        category: {
          id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
          name: 'Furniture',
          slug: 'furniture',
        },
        images: [{ id: 'img-1', path: 'product-images/chair-front.webp', position: 0 }],
      });
    });

    it('should return null when no product is found for the given ID', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      const result = await repository.findByIdWithDetails(productId);

      expect(result).toBeNull();
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

  describe('decrementStockIfAvailable', () => {
    const productId = '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c';

    it('should run ONE atomic UPDATE guarded by stock >= quantity (no FOR UPDATE)', async () => {
      mockDb.query.mockResolvedValueOnce([{ stock: 3 }]);
      const transaction = { id: 'tx' };

      const remaining = await repository.decrementStockIfAvailable(
        { productId, quantity: 2 },
        { transaction }
      );

      expect(remaining).toBe(3);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('SET stock = stock - :quantity');
      expect(sql).toContain('stock >= :quantity');
      expect(sql).toContain("state = 'published'");
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('RETURNING stock');
      expect(sql).not.toMatch(/FOR UPDATE/i);
      expect(options).toMatchObject({ replacements: { productId, quantity: 2 }, transaction });
    });

    it('should return null when no row matched (insufficient stock or unavailable)', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        repository.decrementStockIfAvailable({ productId, quantity: 99 })
      ).resolves.toBeNull();
    });

    it('should allow stock to reach exactly zero', async () => {
      mockDb.query.mockResolvedValueOnce([{ stock: 0 }]);

      await expect(repository.decrementStockIfAvailable({ productId, quantity: 1 })).resolves.toBe(
        0
      );
    });
  });

  describe('IProductRepository Interface', () => {
    it('should throw Method not implemented when calling decrementStockIfAvailable', async () => {
      const iRepo = new IProductRepository();
      await expect(iRepo.decrementStockIfAvailable({})).rejects.toThrow('Method not implemented');
    });

    it('should throw Method not implemented when calling findByIdWithDetails', async () => {
      const iRepo = new IProductRepository();
      await expect(iRepo.findByIdWithDetails('123')).rejects.toThrow('Method not implemented');
    });

    it('should throw Method not implemented when calling findAll', async () => {
      const iRepo = new IProductRepository();
      await expect(iRepo.findAll({})).rejects.toThrow('Method not implemented');
    });
  });
});

const ID = '7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c';
const SELLER_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';

const row = (overrides = {}) => ({
  id: ID,
  seller_id: SELLER_ID,
  category_id: null,
  name: 'Chair',
  slug: 'chair',
  description: null,
  price: '10.50',
  currency: 'USD',
  stock: 3,
  attributes: '{"color":"black"}',
  primary_image_path: null,
  state: 'published',
  average_rating: '4.50',
  ratings_count: 1,
  published_at: null,
  created_at: '2026-10-09T08:00:00.000Z',
  updated_at: '2026-10-10T08:00:00.000Z',
  ...overrides,
});

const imageRow = () => ({
  id: 'img-1',
  product_id: ID,
  path: 'product-images/chair.webp',
  alt_text: null,
  position: 0,
  created_at: '2026-10-10T08:00:00.000Z',
});

describe('ProductRepository — remaining branches', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = { query: vi.fn() };
    repository = new ProductRepository({ db });
  });

  describe('query result normalization', () => {
    const cases = [
      ['nested array', (value) => [[value]]],
      ['flat array', (value) => [value]],
      ['unexpected object', () => undefined],
      ['empty rows', () => []],
    ];

    const methods = [
      [
        'create',
        () =>
          repository.create({
            sellerId: SELLER_ID,
            categoryId: null,
            name: 'Chair',
            slug: 'chair',
          }),
      ],
      ['publish', () => repository.publish({ productId: ID, sellerId: SELLER_ID })],
      ['unpublish', () => repository.unpublish({ productId: ID, sellerId: SELLER_ID })],
      [
        'update',
        () => repository.update({ productId: ID, sellerId: SELLER_ID, fields: { name: 'X' } }),
      ],
      ['softDelete', () => repository.softDelete({ productId: ID, sellerId: SELLER_ID })],
      ['findImageById', () => repository.findImageById('img-1')],
      ['deleteImage', () => repository.deleteImage('img-1')],
      ['recomputePrimaryImage', () => repository.recomputePrimaryImage(ID)],
      ['addImage', () => repository.addImage({ productId: ID, path: 'product-images/chair.webp' })],
      ['listImages', () => repository.listImages(ID)],
      ['findById', () => repository.findById(ID)],
    ];

    it.each(methods)('%s normalizes every query result shape', async (_name, invoke) => {
      for (const [_shape, build] of cases) {
        db.query.mockResolvedValueOnce(build(row()));
        await expect(invoke()).resolves.toBeDefined();
        expect(db.query).toHaveBeenCalledTimes(cases.findIndex(([shape]) => shape === _shape) + 1);
      }

      db.query.mockResolvedValueOnce([]);
      const result = await invoke();
      expect(result === null || (Array.isArray(result) && result.length === 0)).toBe(true);
    });

    it.each([
      ['create', () => repository.create({ sellerId: SELLER_ID, name: 'Chair', slug: 'chair' })],
      ['publish', () => repository.publish({ productId: ID, sellerId: SELLER_ID })],
      ['unpublish', () => repository.unpublish({ productId: ID, sellerId: SELLER_ID })],
      [
        'update',
        () => repository.update({ productId: ID, sellerId: SELLER_ID, fields: { stock: 1 } }),
      ],
      ['softDelete', () => repository.softDelete({ productId: ID, sellerId: SELLER_ID })],
      ['findImageById', () => repository.findImageById('img-1')],
      ['deleteImage', () => repository.deleteImage('img-1')],
      ['recomputePrimaryImage', () => repository.recomputePrimaryImage(ID)],
      ['addImage', () => repository.addImage({ productId: ID, path: 'path' })],
      ['findById', () => repository.findById(ID)],
    ])('%s returns null when no row is returned', async (_name, invoke) => {
      db.query.mockResolvedValueOnce([]);
      await expect(invoke()).resolves.toBeNull();
    });

    it('normalizes listImages and countImages result shapes', async () => {
      db.query.mockResolvedValueOnce([[imageRow()]]);
      await expect(repository.listImages(ID)).resolves.toEqual([imageRow()]);

      db.query.mockResolvedValueOnce([imageRow()]);
      await expect(repository.listImages(ID)).resolves.toEqual([imageRow()]);

      db.query.mockResolvedValueOnce(undefined);
      await expect(repository.listImages(ID)).resolves.toEqual([]);

      db.query.mockResolvedValueOnce([[{ n: 4 }]]);
      await expect(repository.countImages(ID)).resolves.toBe(4);

      db.query.mockResolvedValueOnce([imageRow()]);
      await expect(repository.countImages(ID)).resolves.toBe(0);

      db.query.mockResolvedValueOnce(undefined);
      await expect(repository.countImages(ID)).resolves.toBe(0);
    });
  });

  describe('transaction forwarding', () => {
    const transaction = { id: 'tx' };

    it.each([
      [
        'publish',
        () => repository.publish({ productId: ID, sellerId: SELLER_ID }, { transaction }),
      ],
      [
        'unpublish',
        () => repository.unpublish({ productId: ID, sellerId: SELLER_ID }, { transaction }),
      ],
      [
        'update',
        () =>
          repository.update(
            { productId: ID, sellerId: SELLER_ID, fields: { name: 'Chair' } },
            { transaction }
          ),
      ],
      [
        'softDelete',
        () => repository.softDelete({ productId: ID, sellerId: SELLER_ID }, { transaction }),
      ],
      ['deleteImage', () => repository.deleteImage('img-1', { transaction })],
      ['recomputePrimaryImage', () => repository.recomputePrimaryImage(ID, { transaction })],
      [
        'addImage',
        () =>
          repository.addImage(
            { productId: ID, path: 'product-images/chair.webp' },
            { transaction }
          ),
      ],
      ['listImages', () => repository.listImages(ID, { transaction })],
      ['countImages', () => repository.countImages(ID, { transaction })],
      [
        'setPrimaryImageIfNull',
        () =>
          repository.setPrimaryImageIfNull(
            { productId: ID, path: 'product-images/chair.webp' },
            { transaction }
          ),
      ],
    ])('%s forwards an explicit transaction to sequelize', async (_name, invoke) => {
      db.query.mockResolvedValue([[row()]]);

      await invoke();

      expect(db.query.mock.calls.some(([, options]) => options.transaction === transaction)).toBe(
        true
      );
    });
  });

  describe('create', () => {
    it('applies defaults and forwards an optional transaction', async () => {
      db.query.mockResolvedValueOnce([[row()]]);
      const transaction = { id: 'tx' };

      await repository.create(
        { sellerId: SELLER_ID, name: 'Chair', slug: 'chair', attributes: undefined },
        { transaction }
      );

      expect(db.query.mock.calls[0][1]).toEqual({
        replacements: {
          sellerId: SELLER_ID,
          categoryId: null,
          name: 'Chair',
          slug: 'chair',
          description: null,
          price: undefined,
          currency: 'USD',
          stock: 0,
          attributes: '{}',
        },
        transaction,
      });
    });
  });

  describe('update', () => {
    it('serializes attributes, skips disallowed fields and handles empty updates', async () => {
      db.query.mockResolvedValueOnce([[row()]]);
      await repository.update({
        productId: ID,
        sellerId: SELLER_ID,
        fields: { name: 'New', attributes: undefined, injected: 'DROP TABLE' },
      });

      const [sql, options] = db.query.mock.calls[0];
      expect(sql).toContain('attributes = :attributes::jsonb');
      expect(sql).toContain('name = :name');
      expect(sql).not.toContain('injected');
      expect(options.replacements).toEqual({
        productId: ID,
        sellerId: SELLER_ID,
        attributes: '{}',
        name: 'New',
      });

      await expect(
        repository.update({ productId: ID, sellerId: SELLER_ID, fields: {} })
      ).resolves.toBeNull();
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('setPrimaryImageIfNull', () => {
    it('reports whether the conditional UPDATE matched a row', async () => {
      db.query.mockResolvedValueOnce([[{ id: ID }]]);
      await expect(
        repository.setPrimaryImageIfNull({ productId: ID, path: 'p.webp' })
      ).resolves.toBe(true);

      db.query.mockResolvedValueOnce([]);
      await expect(
        repository.setPrimaryImageIfNull({ productId: ID, path: 'p.webp' })
      ).resolves.toBe(false);

      db.query.mockResolvedValueOnce(undefined);
      await expect(
        repository.setPrimaryImageIfNull({ productId: ID, path: 'p.webp' })
      ).resolves.toBe(false);
    });
  });

  describe('toDomain', () => {
    it('falls back to an empty object for malformed JSON attributes', () => {
      const product = repository.toDomain(row({ attributes: '{broken' }));

      expect(product).toBeInstanceOf(Product);
      expect(product.attributes).toEqual({});
      expect(product.category_id).toBeNull();
    });

    it('keeps a real description instead of applying the null fallback', () => {
      expect(repository.toDomain(row({ description: 'A wooden chair' })).description).toBe(
        'A wooden chair'
      );
    });

    it('applies the empty attributes fallback', () => {
      expect(repository.toDomain(row({ attributes: null })).attributes).toEqual({});
    });
  });

  describe('findAll', () => {
    it('uses defaults for invalid pagination and supports uppercase sort order', async () => {
      db.query.mockResolvedValueOnce([[row()]]);

      await repository.findAll({ page: 'abc', limit: 0, sort: { field: 'price', order: 'ASC' } });

      expect(db.query.mock.calls[0][1].replacements).toMatchObject({ limit: 20, offset: 0 });
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY p.price ASC');
    });

    it('ignores blank price filters and missing totals', async () => {
      db.query.mockResolvedValueOnce([[row()]]);

      const result = await repository.findAll({
        page: null,
        limit: null,
        filters: { minPrice: '', maxPrice: null, categoryId: null, sellerId: '' },
      });

      expect(db.query.mock.calls[0][0]).not.toContain('p.price >=');
      expect(db.query.mock.calls[0][0]).not.toContain('p.price <=');
      expect(result.total).toBe(0);
    });

    it('handles flat and unexpected query results', async () => {
      db.query.mockResolvedValueOnce([row({ total_count: 2 })]);
      await expect(repository.findAll()).resolves.toMatchObject({ total: 2 });

      db.query.mockResolvedValueOnce(undefined);
      await expect(repository.findAll()).resolves.toEqual({ items: [], total: 0 });
    });
  });

  describe('listBySeller', () => {
    it('uses default pagination and returns early when the count is zero', async () => {
      db.query.mockResolvedValueOnce([[{ total: 0 }]]);

      await expect(repository.listBySeller(SELLER_ID)).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('filters by status and maps a flat result set', async () => {
      db.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([row({ state: 'draft' })]);

      const result = await repository.listBySeller(SELLER_ID, {
        page: 'x',
        limit: 'y',
        status: 'draft',
      });

      expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
      expect(result.items[0]).toBeInstanceOf(Product);
      expect(db.query.mock.calls[0][0]).toContain('p.state = :status');
      expect(db.query.mock.calls[0][1].replacements).toMatchObject({ status: 'draft' });
    });

    it('handles nested, flat and unexpected result shapes', async () => {
      db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([[row()]]);
      await expect(repository.listBySeller(SELLER_ID)).resolves.toMatchObject({ total: 1 });

      db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([row()]);
      await expect(repository.listBySeller(SELLER_ID)).resolves.toMatchObject({ total: 1 });

      db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce(undefined);
      await expect(repository.listBySeller(SELLER_ID)).resolves.toMatchObject({ total: 1 });

      db.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      await expect(repository.listBySeller(SELLER_ID)).resolves.toMatchObject({ total: 0 });
    });
  });

  describe('findByIdWithDetails', () => {
    it('falls back to empty values for malformed JSON fields', async () => {
      db.query.mockResolvedValueOnce([
        [
          row({
            attributes: 'not-json',
            seller: 'not-json',
            category: 'not-json',
            images: 'not-json',
          }),
        ],
      ]);

      await expect(repository.findByIdWithDetails(ID)).resolves.toEqual({
        ...row({
          attributes: 'not-json',
          seller: 'not-json',
          category: 'not-json',
          images: 'not-json',
        }),
        attributes: {},
        seller: null,
        category: null,
        images: [],
      });
    });

    it('handles flat results and null optional fields', async () => {
      db.query.mockResolvedValueOnce([
        row({ attributes: null, seller: null, category: null, images: null }),
      ]);

      const result = await repository.findByIdWithDetails(ID);
      expect(result.attributes).toEqual({});
      expect(result.seller).toBeNull();
      expect(result.images).toEqual([]);
    });

    it('returns null for unexpected query results', async () => {
      db.query.mockResolvedValueOnce(undefined);
      await expect(repository.findByIdWithDetails(ID)).resolves.toBeNull();

      db.query.mockResolvedValueOnce([[]]);
      await expect(repository.findByIdWithDetails(ID)).resolves.toBeNull();
    });
  });

  describe('decrementStockIfAvailable', () => {
    it('omits the transaction when none is provided', async () => {
      db.query.mockResolvedValueOnce([{ stock: '2' }]);

      await expect(
        repository.decrementStockIfAvailable({ productId: ID, quantity: 1 })
      ).resolves.toBe(2);
      expect(db.query.mock.calls[0][1]).not.toHaveProperty('transaction');
    });
  });
});
