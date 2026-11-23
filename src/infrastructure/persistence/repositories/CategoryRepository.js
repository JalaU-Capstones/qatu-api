import { Category } from '../../../domain/entities/Category.js';
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository.js';
import { sequelize } from '../../config/sequelize.js';

const CATEGORY_COLUMNS = `
  c.id, c.name, c.slug, c.description, c.parent_id, c.position,
  c.is_active, c.created_at, c.updated_at
`;

function mapUniqueViolation(error) {
  const pgCode = error?.parent?.code || error?.original?.code || error?.code;
  if (pgCode === '23505') {
    const conflict = new Error('A category with this name or slug already exists');
    conflict.statusCode = 409;
    conflict.code = 'CONFLICT';
    return conflict;
  }
  return error;
}

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
   * Maps a database row to a domain Category entity.
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
        SELECT ${CATEGORY_COLUMNS}
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

  async findById(id) {
    const result = await this.db.query(
      `
      SELECT ${CATEGORY_COLUMNS}
      FROM public.categories c
      WHERE c.id = :id
      LIMIT 1
      `,
      { replacements: { id } }
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : [];
    return this.toDomain(rows[0] || null);
  }

  async findByName(name) {
    const result = await this.db.query(
      `
      SELECT ${CATEGORY_COLUMNS}
      FROM public.categories c
      WHERE LOWER(c.name) = LOWER(:name)
      LIMIT 1
      `,
      { replacements: { name } }
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : [];
    return this.toDomain(rows[0] || null);
  }

  async findBySlug(slug) {
    const result = await this.db.query(
      `
      SELECT ${CATEGORY_COLUMNS}
      FROM public.categories c
      WHERE c.slug = :slug
      LIMIT 1
      `,
      { replacements: { slug } }
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : [];
    return this.toDomain(rows[0] || null);
  }

  async create({
    name,
    slug,
    description = null,
    parent_id = null,
    position = 0,
    is_active = true,
  }) {
    try {
      const result = await this.db.query(
        `
        INSERT INTO public.categories (name, slug, description, parent_id, position, is_active)
        VALUES (:name, :slug, :description, :parent_id, :position, :is_active)
        RETURNING id, name, slug, description, parent_id, position, is_active, created_at, updated_at
        `,
        {
          replacements: {
            name,
            slug,
            description: description ?? null,
            parent_id: parent_id ?? null,
            position: Number(position) || 0,
            is_active: is_active !== undefined ? Boolean(is_active) : true,
          },
        }
      );
      const rows = Array.isArray(result?.[0]) ? result[0] : [];
      return this.toDomain(rows[0] || null);
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async update(id, updates = {}) {
    const allowedFields = ['name', 'slug', 'description', 'parent_id', 'position', 'is_active'];
    const setClauses = [];
    const replacements = { id };

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        setClauses.push(`${field} = :${field}`);
        // eslint-disable-next-line security/detect-object-injection
        replacements[field] = updates[field];
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = now()');

    try {
      const result = await this.db.query(
        `
        UPDATE public.categories
        SET ${setClauses.join(', ')}
        WHERE id = :id
        RETURNING id, name, slug, description, parent_id, position, is_active, created_at, updated_at
        `,
        { replacements }
      );
      const rows = Array.isArray(result?.[0]) ? result[0] : [];
      return this.toDomain(rows[0] || null);
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async hasProducts(id) {
    const result = await this.db.query(
      `
      SELECT 1 AS found
      FROM public.products p
      WHERE p.category_id = :id AND p.deleted_at IS NULL
      LIMIT 1
      `,
      { replacements: { id } }
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : [];
    return rows.length > 0;
  }

  async delete(id) {
    const result = await this.db.query(
      `
      DELETE FROM public.categories
      WHERE id = :id
      RETURNING id
      `,
      { replacements: { id } }
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : [];
    return rows.length > 0;
  }
}
