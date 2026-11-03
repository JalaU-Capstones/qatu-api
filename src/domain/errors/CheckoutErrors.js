/**
 * Business-rule failures of the checkout flow.
 */
export class CheckoutError extends Error {
  /**
   * @param {string} message
   * @param {Object} params
   * @param {string} params.code
   * @param {Array<{ field: string, message: string }>} [params.details]
   */
  constructor(message, { code, details = [] }) {
    super(message);
    this.name = new.target.name;
    this.statusCode = 422;
    this.code = code;
    this.details = details;
  }
}

export class EmptyCartError extends CheckoutError {
  constructor() {
    super('Your cart is empty', { code: 'EMPTY_CART' });
  }
}

export class InsufficientStockError extends CheckoutError {
  /**
   * @param {Object} params
   * @param {string} params.productId
   * @param {string} params.productName
   */
  constructor({ productId, productName }) {
    const message = `Insufficient stock for ${productName}`;
    super(message, {
      code: 'INSUFFICIENT_STOCK',
      details: [{ field: `items.${productId}`, message }],
    });
  }
}

export class ProductUnavailableError extends CheckoutError {
  /**
   * @param {Object} params
   * @param {string} params.productId
   * @param {string} params.productName
   */
  constructor({ productId, productName }) {
    const message = `${productName} is no longer available`;
    super(message, {
      code: 'PRODUCT_UNAVAILABLE',
      details: [{ field: `items.${productId}`, message }],
    });
  }
}

export class MixedCurrencyError extends CheckoutError {
  constructor() {
    super('All items in an order must use the same currency', { code: 'MIXED_CURRENCIES' });
  }
}
