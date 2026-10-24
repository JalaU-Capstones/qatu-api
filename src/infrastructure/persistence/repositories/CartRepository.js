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
}
