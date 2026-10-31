// eslint-disable-next-line no-unused-vars
import { CartItem } from '../../domain/entities/CartItem.js';

export class GetCartRequestDTO {
  /**
   * @param {Object} payload
   * @param {string} payload.userId - User identifier
   */
  constructor({ userId } = {}) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      const err = new Error('userId is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    this.userId = userId.trim();

    Object.freeze(this);
  }
}

export class CartItemDTO {
  /**
   * Serializes a cart item row into the snake_case shape required by the
   * OpenAPI `CartItem` schema, optionally populating the referenced product
   * with the full `Product` schema shape.
   *
   * @param {Object} params
   * @param {string} [params.id=null] - Cart item identifier
   * @param {string} params.userId - User identifier (owner of the cart item)
   * @param {string} params.productId - Product identifier
   * @param {number} params.quantity - Quantity (positive integer >= 1)
   * @param {Date|string|null} [params.createdAt=null] - Created at timestamp
   * @param {Date|string|null} [params.updatedAt=null] - Updated at timestamp
   * @param {Object|null} [params.product=null] - Populated product matching the `Product` schema
   */
  constructor({
    id = null,
    userId,
    productId,
    quantity,
    createdAt = null,
    updatedAt = null,
    product = null,
  } = {}) {
    this.id = id ?? null;
    this.userId = userId;
    this.productId = productId;
    this.quantity = Number(quantity);
    this.createdAt = createdAt ?? null;
    this.updatedAt = updatedAt ?? null;
    this.product = product && typeof product === 'object' ? product : null;

    Object.freeze(this);
  }

  /**
   * Returns a snake_case JSON representation matching the `CartItem` schema.
   *
   * @returns {{ id: string|null, user_id: string, product_id: string, quantity: number, created_at: string|null, updated_at: string|null, product?: Object }}
   */
  toJSON() {
    const json = {
      id: this.id,
      user_id: this.userId,
      product_id: this.productId,
      quantity: this.quantity,
      created_at: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      updated_at: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt,
    };

    if (this.product) {
      json.product = this.product;
    }

    return json;
  }
}
