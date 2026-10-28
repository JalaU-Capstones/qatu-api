// eslint-disable-next-line no-unused-vars
import { Order } from '../entities/Order.js';

/**
 * @interface IOrderRepository
 */
export class IOrderRepository {
  constructor() {
    if (this.constructor === IOrderRepository || new.target === IOrderRepository) {
      throw new Error('IOrderRepository cannot be instantiated');
    }
  }

  /**
   * Returns a paginated list of orders for a specific buyer.
   *
   * @param {Object} params
   * @param {string} params.buyerId
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.status]
   * @returns {Promise<{ items: Order[], total: number }>}
   */
  // eslint-disable-next-line no-unused-vars
  async findByBuyerId({ buyerId, page = 1, limit = 20, status } = {}) {
    throw new Error('Method not implemented: findByBuyerId');
  }

  /**
   * Returns an order by its unique identifier, or null if not found.
   *
   * @param {string} orderId
   * @returns {Promise<Order|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findById(orderId) {
    throw new Error('Method not implemented: findById');
  }
}

