import { QueryTypes } from 'sequelize';
import { CartItem } from '../../../domain/entities/CartItem.js';
import { ICartRepository } from '../../../domain/repositories/ICartRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class CartRepository extends ICartRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /**
   * Maps a database row to a domain CartItem entity.
   *
   * @param {Object} row
   * @returns {CartItem|null}
   */
  toDomain(row) {
    if (!row) return null;

    return new CartItem({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      quantity: Number(row.quantity),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    });
  }

  /**
   * Returns the cart item for the given identifier, or null if it does not exist.
   *
   * @param {string} id - Cart Item identifier
   * @returns {Promise<CartItem|null>}
   */
  async findById(id) {
    const rows = await this.db.query(
      `SELECT id, user_id, product_id, quantity, created_at, updated_at
       FROM public.cart_items
       WHERE id = :id
       LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0]);
  }

  /**
   * Returns the cart item for the given user/product pair, or null if it does not exist.
   *
   * @param {Object} params
   * @param {string} params.userId - User identifier
   * @param {string} params.productId - Product identifier
   * @returns {Promise<CartItem|null>}
   */
  async findByUserAndProduct({ userId, productId }) {
    const rows = await this.db.query(
      `SELECT id, user_id, product_id, quantity, created_at, updated_at
       FROM public.cart_items
       WHERE user_id = :userId AND product_id = :productId
       LIMIT 1`,
      {
        replacements: { userId, productId },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0]);
  }

  /**
   * Atomically inserts a cart item or increments its quantity on conflict.
   *
   * @param {Object} params
   * @param {string} params.userId - User identifier
   * @param {string} params.productId - Product identifier
   * @param {number} params.delta - Integer delta >= 1 to increment quantity by
   * @returns {Promise<CartItem>}
   */
  async incrementQuantity({ userId, productId, delta }) {
    const rows = await this.db.query(
      `INSERT INTO public.cart_items (user_id, product_id, quantity)
VALUES (:userId, :productId, :delta)
ON CONFLICT (user_id, product_id)
DO UPDATE SET quantity = public.cart_items.quantity + EXCLUDED.quantity
RETURNING id, user_id, product_id, quantity, created_at, updated_at`,
      {
        replacements: { userId, productId, delta },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      throw new Error('Failed to increment cart item quantity: no row returned');
    }

    return this.toDomain(rows[0]);
  }

  async updateQuantity({ id, quantity }) {
    const rows = await this.db.query(
      `UPDATE public.cart_items
       SET quantity = :quantity, updated_at = NOW()
       WHERE id = :id
       RETURNING id, user_id, product_id, quantity, created_at, updated_at`,
      {
        replacements: { id, quantity },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async removeItem(id) {
    await this.db.query(
      `DELETE FROM public.cart_items
       WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.DELETE,
      }
    );
  }

  async clearCart(userId) {
    await this.db.query(
      `DELETE FROM public.cart_items
       WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.DELETE,
      }
    );
  }

  /**
   * Returns the total number of distinct cart item rows for the given user.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>}
   */
  async countByUser(userId) {
    const rows = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM public.cart_items
       WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return 0;
    }

    return Number(rows[0].total ?? 0);
  }

  /**
   * Retrieves cart items for a user. When `includeProduct` is true, joins
   * the products table and returns product columns aliased with `product_`.
   *
   * @param {string} userId
   * @param {Object} [options]
   * @param {boolean} [options.includeProduct=false]
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, { includeProduct = false } = {}) {
    if (!includeProduct) {
      return this.db.query(
        `SELECT id, user_id, product_id, quantity, created_at, updated_at
         FROM public.cart_items
         WHERE user_id = :userId
         ORDER BY created_at ASC, id ASC`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      );
    }

    return this.db.query(
      `SELECT
         ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
         p.seller_id        AS product_seller_id,
         p.category_id      AS product_category_id,
         p.name             AS product_name,
         p.slug             AS product_slug,
         p.description      AS product_description,
         p.price            AS product_price,
         p.currency         AS product_currency,
         p.stock            AS product_stock,
         p.attributes       AS product_attributes,
         p.primary_image_path AS product_primary_image_path,
         p.state            AS product_state,
         p.average_rating   AS product_average_rating,
         p.ratings_count    AS product_ratings_count,
         p.published_at     AS product_published_at,
         p.created_at       AS product_created_at,
         p.updated_at       AS product_updated_at
       FROM public.cart_items ci
       INNER JOIN public.products p ON p.id = ci.product_id AND p.deleted_at IS NULL
       WHERE ci.user_id = :userId
       ORDER BY ci.created_at ASC, ci.id ASC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
  }
}
