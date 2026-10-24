// eslint-disable-next-line no-unused-vars
import { CartItem } from '../entities/CartItem.js';

/**
 * @interface ICartRepository
 */
export class ICartRepository {
  constructor() {
    if (this.constructor === ICartRepository || new.target === ICartRepository) {
      throw new Error('ICartRepository cannot be instantiated');
    }
  }

  /**
   * Returns the cart item for the given user/product pair, or null if it does not exist.
   * Used by the use case to compute the effective current quantity before checking product stock.
   *
   * @param {Object} params
   * @param {string} params.userId - User identifier
   * @param {string} params.productId - Product identifier
   * @returns {Promise<CartItem|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findByUserAndProduct({ userId, productId }) {
    throw new Error('Method not implemented: findByUserAndProduct');
  }

  /**
   * Increments quantity of a cart item or inserts it if it does not exist.
   * Implementation must be atomic — a single `INSERT ... ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + :delta RETURNING *`. Do NOT implement as read-then-write; that introduces a race condition when two requests target the same (userId, productId).
   *
   * @param {Object} params
   * @param {string} params.userId - User identifier
   * @param {string} params.productId - Product identifier
   * @param {number} params.delta - Integer delta >= 1 to increment the quantity by
   * @returns {Promise<CartItem>} The resulting row as a CartItem
   */
  // eslint-disable-next-line no-unused-vars
  async incrementQuantity({ userId, productId, delta }) {
    throw new Error('Method not implemented: incrementQuantity');
  }

  /**
   * Returns the total number of rows in the user's cart.
   * Used by the frontend to render the cart indicator badge.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>}
   */
  // eslint-disable-next-line no-unused-vars
  async countByUser(userId) {
    throw new Error('Method not implemented: countByUser');
  }
}
