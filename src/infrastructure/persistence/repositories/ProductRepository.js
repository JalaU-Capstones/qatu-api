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
}
