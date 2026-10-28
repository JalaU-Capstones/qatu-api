/**
 * OrderItem Domain Entity.
 * Represents an individual item within a purchase order.
 */
export class OrderItem {
  /**
   * @param {Object} params
   * @param {string|null} [params.id=null]
   * @param {string} params.orderId
   * @param {string} [params.order_id]
   * @param {string|null} [params.productId=null]
   * @param {string|null} [params.product_id]
   * @param {string} params.productName
   * @param {string} [params.product_name]
   * @param {string|null} [params.productImagePath=null]
   * @param {string|null} [params.product_image_path]
   * @param {number} params.quantity
   * @param {number} params.unitPrice
   * @param {number} [params.unit_price]
   * @param {number|null} [params.subtotal=null]
   * @param {Date|string|null} [params.createdAt=null]
   * @param {Date|string|null} [params.created_at]
   */
  constructor({
    id = null,
    orderId,
    order_id,
    productId = null,
    product_id,
    productName,
    product_name,
    productImagePath = null,
    product_image_path,
    quantity,
    unitPrice,
    unit_price,
    subtotal = null,
    createdAt = null,
    created_at = null,
  } = {}) {
    const resolvedOrderId = orderId !== undefined ? orderId : order_id;
    const resolvedProductName = productName !== undefined ? productName : product_name;
    const resolvedUnitPrice = unitPrice !== undefined ? unitPrice : unit_price;
    const resolvedProductId = productId !== undefined ? productId : (product_id ?? null);
    const resolvedImagePath =
      productImagePath !== undefined ? productImagePath : (product_image_path ?? null);

    if (!resolvedOrderId || typeof resolvedOrderId !== 'string') {
      throw new TypeError('OrderItem orderId is required');
    }
    if (!resolvedProductName || typeof resolvedProductName !== 'string') {
      throw new TypeError('OrderItem productName is required');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('OrderItem quantity must be a positive integer');
    }
    if (typeof resolvedUnitPrice !== 'number' || resolvedUnitPrice < 0) {
      throw new RangeError('OrderItem unitPrice must be a non-negative number');
    }

    const rawCreatedAt = createdAt !== undefined && createdAt !== null ? createdAt : created_at;

    this._id = id ?? null;
    this._orderId = resolvedOrderId.trim();
    this._productId = resolvedProductId ? resolvedProductId.trim() : null;
    this._productName = resolvedProductName.trim();
    this._productImagePath = resolvedImagePath ? resolvedImagePath.trim() : null;
    this._quantity = quantity;
    this._unitPrice = resolvedUnitPrice;
    this._subtotal = subtotal !== null ? Number(subtotal) : this._quantity * this._unitPrice;
    this._createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;

    Object.freeze(this);
  }

  get id() {
    return this._id;
  }

  get orderId() {
    return this._orderId;
  }

  get productId() {
    return this._productId;
  }

  get productName() {
    return this._productName;
  }

  get productImagePath() {
    return this._productImagePath;
  }

  get quantity() {
    return this._quantity;
  }

  get unitPrice() {
    return this._unitPrice;
  }

  get subtotal() {
    return this._subtotal;
  }

  get createdAt() {
    return this._createdAt ? new Date(this._createdAt.getTime()) : null;
  }

  toJSON() {
    return {
      id: this._id,
      order_id: this._orderId,
      product_id: this._productId,
      product_name: this._productName,
      product_image_path: this._productImagePath,
      quantity: this._quantity,
      unit_price: this._unitPrice,
      subtotal: this._subtotal,
      created_at: this._createdAt ? this._createdAt.toISOString() : null,
    };
  }
}

