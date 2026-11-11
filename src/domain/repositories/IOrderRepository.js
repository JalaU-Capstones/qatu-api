// eslint-disable-next-line no-unused-vars
import { Order } from '../entities/Order.js';

/** @interface IOrderRepository */
export class IOrderRepository {
  constructor() {
    if (this.constructor === IOrderRepository || new.target === IOrderRepository) {
      throw new Error('IOrderRepository cannot be instantiated');
    }
  }

  /** @returns {Promise<{ items: Order[], total: number }>} */
  // eslint-disable-next-line no-unused-vars
  async findByBuyerId({ buyerId, page = 1, limit = 20, status } = {}) {
    throw new Error('Method not implemented: findByBuyerId');
  }

  /** Seller orders with items filtered to that seller. */
  // eslint-disable-next-line no-unused-vars
  async findBySellerId({ sellerId, page = 1, limit = 20, status } = {}) {
    throw new Error('Method not implemented: findBySellerId');
  }

  /** Admin: all orders. */
  // eslint-disable-next-line no-unused-vars
  async findAll({ page = 1, limit = 20, status } = {}) {
    throw new Error('Method not implemented: findAll');
  }

  /** @returns {Promise<Order|null>} */
  // eslint-disable-next-line no-unused-vars
  async findById(orderId) {
    throw new Error('Method not implemented: findById');
  }

  /** True if the seller owns ≥1 line on the order. */
  // eslint-disable-next-line no-unused-vars
  async sellerHasItemsOnOrder(orderId, sellerId) {
    throw new Error('Method not implemented: sellerHasItemsOnOrder');
  }

  /** Order detail with only that seller's items. */
  // eslint-disable-next-line no-unused-vars
  async findByIdForSeller(orderId, sellerId) {
    throw new Error('Method not implemented: findByIdForSeller');
  }

  /**
   * Persist status (+ timestamp column) and return the order.
   * With `itemsSellerId`, the returned order only carries that seller's items.
   */
  /* eslint-disable no-unused-vars */
  async updateStatus({
    orderId,
    status,
    timestampColumn = null,
    itemsSellerId = null,
    transaction,
  } = {}) {
    throw new Error('Method not implemented: updateStatus');
  }
  /* eslint-enable no-unused-vars */

  /** Insert pending order + items. */
  // eslint-disable-next-line no-unused-vars
  async createWithItems(params, { transaction } = {}) {
    throw new Error('Method not implemented: createWithItems');
  }
}
