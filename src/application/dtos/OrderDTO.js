export class ListOrdersRequestDTO {
  /**
   * @param {Object} params
   * @param {string} params.buyerId
   * @param {number|string} [params.page=1]
   * @param {number|string} [params.limit=20]
   * @param {string} [params.status]
   */
  constructor({ buyerId, page = 1, limit = 20, status } = {}) {
    if (!buyerId || typeof buyerId !== 'string') {
      throw new TypeError('buyerId is required');
    }

    this.buyerId = buyerId.trim();
    this.page = page !== undefined && page !== null && page !== '' ? Number(page) : 1;
    this.limit = limit !== undefined && limit !== null && limit !== '' ? Number(limit) : 20;
    this.status = typeof status === 'string' && status.trim() !== '' ? status.trim() : undefined;
  }
}

export class OrderListItemDTO {
  /**
   * @param {import('../../domain/entities/Order.js').Order} order
   */
  constructor(order) {
    if (!order) {
      throw new Error('Order entity is required');
    }
    const json = typeof order.toJSON === 'function' ? order.toJSON() : order;
    Object.assign(this, json);
  }

  toJSON() {
    return {
      id: this.id,
      order_number: this.order_number,
      buyer_id: this.buyer_id,
      status: this.status,
      currency: this.currency,
      subtotal: this.subtotal,
      shipping_cost: this.shipping_cost,
      tax: this.tax,
      total: this.total,
      shipping_address: this.shipping_address,
      notes: this.notes,
      cancellation_reason: this.cancellation_reason,
      confirmed_at: this.confirmed_at,
      shipped_at: this.shipped_at,
      delivered_at: this.delivered_at,
      cancelled_at: this.cancelled_at,
      items: this.items || [],
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

export class OrderDetailDTO {
  /**
   * @param {import('../../domain/entities/Order.js').Order} order
   */
  constructor(order) {
    if (!order) {
      throw new Error('Order entity is required');
    }
    const json = typeof order.toJSON === 'function' ? order.toJSON() : order;
    Object.assign(this, json);
  }

  toJSON() {
    return {
      id: this.id,
      order_number: this.order_number,
      buyer_id: this.buyer_id,
      status: this.status,
      currency: this.currency,
      subtotal: this.subtotal,
      shipping_cost: this.shipping_cost,
      tax: this.tax,
      total: this.total,
      shipping_address: this.shipping_address,
      notes: this.notes,
      cancellation_reason: this.cancellation_reason,
      confirmed_at: this.confirmed_at,
      shipped_at: this.shipped_at,
      delivered_at: this.delivered_at,
      cancelled_at: this.cancelled_at,
      items: this.items || [],
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
