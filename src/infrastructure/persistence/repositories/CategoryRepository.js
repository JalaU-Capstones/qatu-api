import { Category } from '../../../domain/entities/Category.js';
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class CategoryRepository extends ICategoryRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /**
   *Maps a database row to a domain Category entity
   *
   * @param {Object} row
   * @returns {Category|null}
   */
  toDomain(row) {
    if (!row) return null;

    return new Category({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      parent_id: row.parent_id ?? null,
      position: row.position,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Lists active categories ordered by position, then name.
   * The total is counted in its own query so it stays accurate for out-of-range pages.
   *
   * @param {Object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @returns {Promise<{ items: Category[], total: number }>}
   */
  async findAll({ page = 1, limit = 20 } = {}) {
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 20);
    const offsetNumber = (pageNumber - 1) * limitNumber;

    const [countResult, rowsResult] = await Promise.all([
      this.db.query('SELECT COUNT(*) AS total FROM public.categories c WHERE c.is_active = true'),
      this.db.query(
        `
  SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.position,
         c.is_active, c.created_at, c.updated_at
  FROM public.categories c
  WHERE c.is_active = true
  ORDER BY c.position ASC, c.name ASC, c.id ASC
  LIMIT :limit OFFSET :offset
`,
        { replacements: { limit: limitNumber, offset: offsetNumber } }
      ),
    ]);

    const countRows = Array.isArray(countResult?.[0]) ? countResult[0] : [];
    const total = Number(countRows[0]?.total ?? 0);
    const rows = Array.isArray(rowsResult?.[0]) ? rowsResult[0] : [];

    return { items: rows.map((row) => this.toDomain(row)), total };
  }
}
