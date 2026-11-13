import { QueryTypes } from 'sequelize';
import { Product } from '../../../domain/entities/Product.js';
import { IProductRepository } from '../../../domain/repositories/IProductRepository.js';
import { sequelize } from '../../config/sequelize.js';

const SORT_COLUMNS = new Map([
  ['created_at', 'p.created_at'],
  ['price', 'p.price'],
  ['name', 'p.name'],
  ['average_rating', 'p.average_rating'],
]);

/**
 * Escapes the LIKE/ILIKE wildcards so user input is always matched literally
 * PostgreSQL uses backslash as the default escape character.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

export class ProductRepository extends IProductRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /**
   * Creates a new product row and returns the inserted record.
   *
   * @param {Object} data
   * @param {string} data.sellerId
   * @param {string} data.categoryId
   * @param {string} data.name
   * @param {string} data.slug
   * @param {string} [data.description]
   * @param {number} data.price
   * @param {string} data.currency
   * @param {number} data.stock
   * @param {Object} [data.attributes]
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object>}
   */
  async create(
    { sellerId, categoryId, name, slug, description, price, currency, stock, attributes },
    { transaction } = {}
  ) {
    const sql = `
      INSERT INTO public.products (
        seller_id, category_id, name, slug, description, price, currency,
        stock, attributes, state, published_at, primary_image_path,
        average_rating, ratings_count, deleted_at
      )
      VALUES (
        :sellerId, :categoryId, :name, :slug, :description, :price,
        :currency, :stock, :attributes::jsonb, 'draft', NULL, NULL,
        0, 0, NULL
      )
      RETURNING *
    `;

    const queryResult = await this.db.query(sql, {
      replacements: {
        sellerId,
        categoryId: categoryId ?? null,
        name,
        slug,
        description: description ?? null,
        price,
        currency: currency || 'USD',
        stock: stock ?? 0,
        attributes: JSON.stringify(attributes ?? {}),
      },
      ...(transaction ? { transaction } : {}),
    });

    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    if (!rows || rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  async publish({ productId, sellerId }, { transaction } = {}) {
    const sql = `
      UPDATE public.products
      SET state = 'published', updated_at = now()
      WHERE id = :productId
        AND seller_id = :sellerId
        AND state = 'draft'
        AND deleted_at IS NULL
      RETURNING *
    `;

    const queryResult = await this.db.query(sql, {
      replacements: { productId, sellerId },
      ...(transaction ? { transaction } : {}),
    });

    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    return rows[0] ?? null;
  }

  /**
   * Maps a database row to a domain Product entity.
   *
   * @param {Object} row
   * @returns {Product|null}
   */
  toDomain(row) {
    if (!row) return null;

    let attributes = row.attributes;
    if (typeof attributes === 'string') {
      try {
        attributes = JSON.parse(attributes);
      } catch {
        attributes = {};
      }
    }

    return new Product({
      id: row.id,
      seller_id: row.seller_id,
      category_id: row.category_id ?? null,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      price: row.price,
      currency: row.currency,
      stock: row.stock,
      attributes: attributes ?? {},
      primary_image_path: row.primary_image_path ?? null,
      state: row.state,
      average_rating: row.average_rating,
      ratings_count: row.ratings_count,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /** One atomic UPDATE ... WHERE stock >= qty: the remaining stock, or null if not reservable. */
  async decrementStockIfAvailable({ productId, quantity }, { transaction } = {}) {
    const rows = await this.db.query(
      `UPDATE public.products
       SET stock = stock - :quantity, updated_at = NOW()
       WHERE id = :productId
         AND stock >= :quantity
         AND state = 'published'
         AND deleted_at IS NULL
       RETURNING stock`,
      {
        replacements: { productId, quantity },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );

    if (!rows || rows.length === 0) {
      return null;
    }
    return Number(rows[0].stock);
  }

  /**
   * Find a single, non-deleted product by its UUID.
   * Does NOT filter by `state` — the caller decides whether unpublished products are acceptable.
   *
   * @param {string} productId
   * @returns {Promise<Product|null>}
   */
  async findById(productId) {
    const sql = `
  SELECT
    p.id, p.seller_id, p.category_id, p.name, p.slug, p.description,
    p.price, p.currency, p.stock, p.attributes, p.primary_image_path,
    p.state, p.average_rating, p.ratings_count, p.published_at,
    p.created_at, p.updated_at
  FROM public.products p
  WHERE p.id = :productId AND p.deleted_at IS NULL
  LIMIT 1
`;

    const queryResult = await this.db.query(sql, {
      replacements: { productId },
    });
    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0]);
  }

  /**
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {Object} [params.filters]
   * @param {string} [params.filters.search]
   * @param {string} [params.filters.categoryId]
   * @param {string} [params.filters.category_id]
   * @param {number} [params.filters.minPrice]
   * @param {number} [params.filters.min_price]
   * @param {number} [params.filters.maxPrice]
   * @param {number} [params.filters.max_price]
   * @param {string} [params.filters.sellerId]
   * @param {string} [params.filters.seller_id]
   * @param {Object} [params.sort]
   * @param {string} [params.sort.field]
   * @param {'asc'|'desc'|'ASC'|'DESC'} [params.sort.order]
   * @returns {Promise<{ items: Product[], total: number }>}
   */
  async findAll({ page = 1, limit = 20, filters = {}, sort = {} } = {}) {
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 20);
    const offsetNumber = (pageNumber - 1) * limitNumber;

    const replacements = {
      limit: limitNumber,
      offset: offsetNumber,
    };

    const whereClauses = ["p.state = 'published'", 'p.deleted_at IS NULL'];

    const search = filters?.search;
    if (typeof search === 'string' && search.trim() !== '') {
      const term = search.trim();
      whereClauses.push(
        "(p.search_vector @@ plainto_tsquery('simple', :search)" +
          ' OR p.name ILIKE :searchPattern OR p.description ILIKE :searchPattern)'
      );
      replacements.search = term;
      replacements.searchPattern = `%${escapeLikePattern(term)}%`;
    }

    const categoryId = filters?.categoryId ?? filters?.category_id;
    if (categoryId) {
      whereClauses.push('p.category_id = :categoryId');
      replacements.categoryId = categoryId;
    }

    const minPrice = filters?.minPrice ?? filters?.min_price;
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      whereClauses.push('p.price >= :minPrice');
      replacements.minPrice = Number(minPrice);
    }

    const maxPrice = filters?.maxPrice ?? filters?.max_price;
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      whereClauses.push('p.price <= :maxPrice');
      replacements.maxPrice = Number(maxPrice);
    }

    const sellerId = filters?.sellerId ?? filters?.seller_id;
    if (sellerId) {
      whereClauses.push('p.seller_id = :sellerId');
      replacements.sellerId = sellerId;
    }

    const sortField = sort?.field ? String(sort.field).toLowerCase() : undefined;
    const isSupportedField = Boolean(sortField && SORT_COLUMNS.has(sortField));

    const orderColumn = isSupportedField ? SORT_COLUMNS.get(sortField) : 'p.created_at';
    const orderDirection =
      isSupportedField && String(sort?.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereSql = whereClauses.join(' AND ');

    const sql = `
  SELECT
    p.id, p.seller_id, p.category_id, p.name, p.slug, p.description,
    p.price, p.currency, p.stock, p.attributes, p.primary_image_path,
    p.state, p.average_rating, p.ratings_count, p.published_at,
    p.created_at, p.updated_at,
    COUNT(*) OVER() AS total_count
  FROM public.products p
  WHERE ${whereSql}
  ORDER BY ${orderColumn} ${orderDirection}, p.id DESC
  LIMIT :limit OFFSET :offset
`;

    const queryResult = await this.db.query(sql, { replacements });
    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    if (!rows || rows.length === 0) {
      return { items: [], total: 0 };
    }

    const total = Number(rows[0].total_count ?? 0);
    const items = rows.map((row) => this.toDomain(row));

    return { items, total };
  }

  /**
   * Paginated list of products owned by a seller, optionally filtered by state.
   *
   * @param {string} sellerId
   * @param {{ page?: number, limit?: number, status?: 'draft'|'published' }} [options]
   * @returns {Promise<{ items: Product[], total: number, page: number, limit: number }>}
   */
  async listBySeller(sellerId, { page = 1, limit = 20, status } = {}) {
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 20);
    const offsetNumber = (pageNumber - 1) * limitNumber;
    const replacements = {
      sellerId,
      limit: limitNumber,
      offset: offsetNumber,
    };

    const whereClauses = ['p.seller_id = :sellerId', 'p.deleted_at IS NULL'];
    if (status) {
      whereClauses.push('p.state = :status');
      replacements.status = status;
    }

    const whereSql = whereClauses.join(' AND ');

    const countResult = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM public.products p
       WHERE ${whereSql}`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    const total = Number(countResult?.[0]?.total ?? 0);
    if (total === 0) {
      return { items: [], total, page: pageNumber, limit: limitNumber };
    }

    const queryResult = await this.db.query(
      `SELECT
        p.id, p.seller_id, p.category_id, p.name, p.slug, p.description,
        p.price, p.currency, p.stock, p.attributes, p.primary_image_path,
        p.state, p.average_rating, p.ratings_count, p.published_at,
        p.created_at, p.updated_at
      FROM public.products p
      WHERE ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT :limit OFFSET :offset`,
      {
        replacements,
      }
    );

    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    return {
      items: rows.map((row) => this.toDomain(row)),
      total,
      page: pageNumber,
      limit: limitNumber,
    };
  }

  /**
   * Find a single product with full relational details (seller, category, images).
   *
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(productId) {
    const sql = `
      SELECT
        p.id, p.seller_id, p.category_id, p.name, p.slug, p.description,
        p.price, p.currency, p.stock, p.attributes, p.primary_image_path,
        p.state, p.average_rating, p.ratings_count, p.published_at,
        p.created_at, p.updated_at,
        json_build_object(
          'id', prof.id,
          'username', prof.username,
          'full_name', prof.full_name,
          'avatar_path', prof.avatar_path
        ) AS seller,
        CASE WHEN c.id IS NOT NULL THEN
          json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug
          )
        ELSE NULL END AS category,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', img.id,
                'image_path', img.image_path,
                'position', img.position
              ) ORDER BY img.position ASC
            )
            FROM public.product_images img
            WHERE img.product_id = p.id
          ), '[]'::json
        ) AS images
      FROM public.products p
      LEFT JOIN public.profiles prof ON prof.id = p.seller_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE p.id = :productId AND p.deleted_at IS NULL
      LIMIT 1
    `;

    const queryResult = await this.db.query(sql, { replacements: { productId } });
    const rows =
      Array.isArray(queryResult) && Array.isArray(queryResult[0])
        ? queryResult[0]
        : Array.isArray(queryResult)
          ? queryResult
          : [];

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Parse stringified JSON fields if necessary
    let attributes = row.attributes;
    if (typeof attributes === 'string') {
      try {
        attributes = JSON.parse(attributes);
      } catch {
        attributes = {};
      }
    }

    let seller = row.seller;
    if (typeof seller === 'string') {
      try {
        seller = JSON.parse(seller);
      } catch {
        seller = null;
      }
    }

    let category = row.category;
    if (typeof category === 'string') {
      try {
        category = JSON.parse(category);
      } catch {
        category = null;
      }
    }

    let images = row.images;
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
      } catch {
        images = [];
      }
    }

    return {
      ...row,
      attributes: attributes || {},
      seller,
      category,
      images: images || [],
    };
  }
}
