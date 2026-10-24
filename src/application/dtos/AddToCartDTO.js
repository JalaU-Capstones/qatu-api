// eslint-disable-next-line no-unused-vars
import { CartItem } from '../../domain/entities/CartItem.js';

export class AddToCartRequestDTO {
  /**
   * @param {Object} payload
   * @param {string} payload.userId - User identifier
   * @param {string} payload.productId - Product identifier
   * @param {number} [payload.quantity=1] - Quantity to add (positive integer >= 1)
   */
  constructor({ userId, productId, quantity } = {}) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      const err = new Error('userId is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      const err = new Error('productId is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    let resolvedQuantity = 1;
    if (quantity !== undefined && quantity !== null) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        const err = new Error('quantity must be an integer greater than or equal to 1');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      resolvedQuantity = quantity;
    }

    this.userId = userId.trim();
    this.productId = productId.trim();
    this.quantity = resolvedQuantity;

    Object.freeze(this);
  }
}

export class AddToCartResponseDTO {
  /**
   * @param {Object} params
   * @param {CartItem} params.item - Cart item entity
   * @param {number} params.itemCount - Total number of cart items for the user
   */
  constructor({ item, itemCount }) {
    this.item = item;
    this.itemCount = Number(itemCount ?? 0);

    Object.freeze(this);
  }

  /**
   * Returns a snake_case JSON representation for the API response.
   *
   * @returns {{ item: { id: string|null, product_id: string, quantity: number, created_at: string|null, updated_at: string|null }, cart: { item_count: number } }}
   */
  toJSON() {
    const item = this.item;
    return {
      item: {
        id: item.id,
        product_id: item.productId,
        quantity: item.quantity,
        created_at: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        updated_at: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
      },
      cart: {
        item_count: this.itemCount,
      },
    };
  }
}
