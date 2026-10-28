import { OrderItem } from './OrderItem.js';

const VALID_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

const VALID_CURRENCIES = Object.freeze(['USD', 'EUR', 'BOB', 'PEN', 'ARS', 'COP', 'MXN', 'BRL']);

/**
 * Order Domain Entity.
 * Represents a purchase order placed by a buyer on the marketplace.
 */
export class Order {
  /**
   * @param {Object} params
   * @param {string|null} [params.id=null]
   * @param {string} params.orderNumber
   * @param {string} [params.order_number]
   * @param {string} params.buyerId
   * @param {string} [params.buyer_id]
   * @param {string} [params.status='pending']
   * @param {string} [params.currency='USD']
   * @param {number} [params.subtotal=0]
   * @param {number} [params.shippingCost=0]
   * @param {number} [params.shipping_cost=0]
   * @param {number} [params.tax=0]
   * @param {number} [params.total=0]
   * @param {Object|null} [params.shippingAddress=null]
   * @param {Object|null} [params.shipping_address=null]
   * @param {string|null} [params.notes=null]
   * @param {string|null} [params.cancellationReason=null]
   * @param {string|null} [params.cancellation_reason=null]
   * @param {Date|string|null} [params.confirmedAt=null]
   * @param {Date|string|null} [params.confirmed_at]
   * @param {Date|string|null} [params.shippedAt=null]
   * @param {Date|string|null} [params.shipped_at]
   * @param {Date|string|null} [params.deliveredAt=null]
   * @param {Date|string|null} [params.delivered_at]
   * @param {Date|string|null} [params.cancelledAt=null]
   * @param {Date|string|null} [params.cancelled_at]
   * @param {Date|string|null} [params.createdAt=null]
   * @param {Date|string|null} [params.created_at]
   * @param {Date|string|null} [params.updatedAt=null]
   * @param {Date|string|null} [params.updated_at]
   * @param {Array<OrderItem|Object>} [params.items=[]]
   */
  constructor({
    id = null,
    orderNumber,
    order_number,
    buyerId,
    buyer_id,
    status = 'pending',
    currency = 'USD',
    subtotal = 0,
    shippingCost,
    shipping_cost = 0,
    tax = 0,
    total,
    shippingAddress,
    shipping_address = null,
    notes = null,
    cancellationReason,
    cancellation_reason = null,
    confirmedAt = null,
    confirmed_at = null,
    shippedAt = null,
    shipped_at = null,
    deliveredAt = null,
    delivered_at = null,
    cancelledAt = null,
    cancelled_at = null,
    createdAt = null,
    created_at = null,
    updatedAt = null,
    updated_at = null,
    items = [],
  } = {}) {
    const resolvedOrderNumber = orderNumber !== undefined ? orderNumber : order_number;
    const resolvedBuyerId = buyerId !== undefined ? buyerId : buyer_id;
    const resolvedShippingCost = shippingCost !== undefined ? shippingCost : shipping_cost;
    const resolvedShippingAddress =
      shippingAddress !== undefined ? shippingAddress : shipping_address;
    const resolvedCancellationReason =
      cancellationReason !== undefined ? cancellationReason : cancellation_reason;

    if (!resolvedOrderNumber || typeof resolvedOrderNumber !== 'string') {
      throw new TypeError('Order orderNumber is required');
    }
    if (!resolvedBuyerId || typeof resolvedBuyerId !== 'string') {
      throw new TypeError('Order buyerId is required');
    }
    if (!VALID_STATUSES.includes(status)) {
      throw new RangeError(`Invalid order status: ${status}`);
    }
    if (!VALID_CURRENCIES.includes(currency)) {
      throw new RangeError(`Invalid currency: ${currency}`);
    }

    const numSubtotal = Number(subtotal);
    const numShippingCost = Number(resolvedShippingCost);
    const numTax = Number(tax);
    const numTotal = total !== undefined ? Number(total) : numSubtotal + numShippingCost + numTax;

    if (numSubtotal < 0 || numShippingCost < 0 || numTax < 0 || numTotal < 0) {
      throw new RangeError('Financial amounts for Order cannot be negative');
    }

    const rawConfirmedAt =
      confirmedAt !== undefined && confirmedAt !== null ? confirmedAt : confirmed_at;
    const rawShippedAt = shippedAt !== undefined && shippedAt !== null ? shippedAt : shipped_at;
    const rawDeliveredAt =
      deliveredAt !== undefined && deliveredAt !== null ? deliveredAt : delivered_at;
    const rawCancelledAt =
      cancelledAt !== undefined && cancelledAt !== null ? cancelledAt : cancelled_at;
    const rawCreatedAt = createdAt !== undefined && createdAt !== null ? createdAt : created_at;
    const rawUpdatedAt = updatedAt !== undefined && updatedAt !== null ? updatedAt : updated_at;

    this._id = id ?? null;
    this._orderNumber = resolvedOrderNumber.trim();
    this._buyerId = resolvedBuyerId.trim();
    this._status = status;
    this._currency = currency;
    this._subtotal = numSubtotal;
    this._shippingCost = numShippingCost;
    this._tax = numTax;
    this._total = numTotal;
    this._shippingAddress = resolvedShippingAddress || null;
    this._notes = notes ? String(notes).trim() : null;
    this._cancellationReason = resolvedCancellationReason
      ? String(resolvedCancellationReason).trim()
      : null;

    this._confirmedAt = rawConfirmedAt ? new Date(rawConfirmedAt) : null;
    this._shippedAt = rawShippedAt ? new Date(rawShippedAt) : null;
    this._deliveredAt = rawDeliveredAt ? new Date(rawDeliveredAt) : null;
    this._cancelledAt = rawCancelledAt ? new Date(rawCancelledAt) : null;
    this._createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
    this._updatedAt = rawUpdatedAt ? new Date(rawUpdatedAt) : null;

    this._items = Array.isArray(items)
      ? items.map((item) => (item instanceof OrderItem ? item : new OrderItem(item)))
      : [];

    Object.freeze(this);
  }

  get id() {
    return this._id;
  }

  get orderNumber() {
    return this._orderNumber;
  }

  get buyerId() {
    return this._buyerId;
  }

  get status() {
    return this._status;
  }

  get currency() {
    return this._currency;
  }

  get subtotal() {
    return this._subtotal;
  }

  get shippingCost() {
    return this._shippingCost;
  }

  get tax() {
    return this._tax;
  }

  get total() {
    return this._total;
  }

  get shippingAddress() {
    return this._shippingAddress;
  }

  get notes() {
    return this._notes;
  }

  get cancellationReason() {
    return this._cancellationReason;
  }

  get confirmedAt() {
    return this._confirmedAt ? new Date(this._confirmedAt.getTime()) : null;
  }

  get shippedAt() {
    return this._shippedAt ? new Date(this._shippedAt.getTime()) : null;
  }

  get deliveredAt() {
    return this._deliveredAt ? new Date(this._deliveredAt.getTime()) : null;
  }

  get cancelledAt() {
    return this._cancelledAt ? new Date(this._cancelledAt.getTime()) : null;
  }

  get createdAt() {
    return this._createdAt ? new Date(this._createdAt.getTime()) : null;
  }

  get updatedAt() {
    return this._updatedAt ? new Date(this._updatedAt.getTime()) : null;
  }

  get items() {
    return [...this._items];
  }

  toJSON() {
    return {
      id: this._id,
      order_number: this._orderNumber,
      buyer_id: this._buyerId,
      status: this._status,
      currency: this._currency,
      subtotal: this._subtotal,
      shipping_cost: this._shippingCost,
      tax: this._tax,
      total: this._total,
      shipping_address: this._shippingAddress,
      notes: this._notes,
      cancellation_reason: this._cancellationReason,
      confirmed_at: this._confirmedAt ? this._confirmedAt.toISOString() : null,
      shipped_at: this._shippedAt ? this._shippedAt.toISOString() : null,
      delivered_at: this._deliveredAt ? this._deliveredAt.toISOString() : null,
      cancelled_at: this._cancelledAt ? this._cancelledAt.toISOString() : null,
      created_at: this._createdAt ? this._createdAt.toISOString() : null,
      updated_at: this._updatedAt ? this._updatedAt.toISOString() : null,
      items: this._items.map((item) => item.toJSON()),
    };
  }
}
