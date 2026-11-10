export class ListOrdersRequestDTO {
  /** @param {{ userId?: string, buyerId?: string, page?: number|string, limit?: number|string, status?: string, view?: string, roleHint?: string|null }} [params] */
  constructor({
    userId,
    buyerId,
    page = 1,
    limit = 20,
    status,
    view = 'buyer',
    roleHint = null,
  } = {}) {
    const resolvedUserId = userId || buyerId;
    if (!resolvedUserId || typeof resolvedUserId !== 'string') {
      throw new TypeError('userId is required');
    }

    const resolvedView = typeof view === 'string' && view.trim() !== '' ? view.trim() : 'buyer';
    if (!['buyer', 'seller', 'admin'].includes(resolvedView)) {
      throw new TypeError('view must be one of: buyer, seller, admin');
    }

    this.userId = resolvedUserId.trim();
    this.buyerId = this.userId;
    this.page = page !== undefined && page !== null && page !== '' ? Number(page) : 1;
    this.limit = limit !== undefined && limit !== null && limit !== '' ? Number(limit) : 20;
    this.status = typeof status === 'string' && status.trim() !== '' ? status.trim() : undefined;
    this.view = resolvedView;
    this.roleHint = typeof roleHint === 'string' ? roleHint : null;
  }
}

export class OrderListItemDTO {
  /** @param {import('../../domain/entities/Order.js').Order} order */
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
  /** @param {import('../../domain/entities/Order.js').Order} order */
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
