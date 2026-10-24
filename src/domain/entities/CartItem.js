/**
 * CartItem Domain Entity.
 * Represents an item in a user's shopping cart within the pure domain layer.
 */
export class CartItem {
  /**
   * @param {Object} params
   * @param {string|null} [params.id=null] - Unique identifier of the cart item (nullable before persistence)
   * @param {string} params.userId - Unique identifier of the user who owns the cart item
   * @param {string} [params.user_id] - Snake_case alias for userId
   * @param {string} params.productId - Unique identifier of the product
   * @param {string} [params.product_id] - Snake_case alias for productId
   * @param {number} params.quantity - Quantity of the product in the cart (must be an integer >= 1)
   * @param {Date|string|null} [params.createdAt=null] - Timestamp when the item was added to the cart
   * @param {Date|string|null} [params.created_at=null] - Snake_case alias for createdAt
   * @param {Date|string|null} [params.updatedAt=null] - Timestamp when the item was last updated
   * @param {Date|string|null} [params.updated_at=null] - Snake_case alias for updatedAt
   */
  constructor({
    id = null,
    userId,
    user_id,
    productId,
    product_id,
    quantity,
    createdAt = null,
    created_at = null,
    updatedAt = null,
    updated_at = null,
  } = {}) {
    const resolvedUserId = userId !== undefined ? userId : user_id;
    if (typeof resolvedUserId !== 'string' || resolvedUserId.trim() === '') {
      throw new TypeError('CartItem userId is required');
    }

    const resolvedProductId = productId !== undefined ? productId : product_id;
    if (typeof resolvedProductId !== 'string' || resolvedProductId.trim() === '') {
      throw new TypeError('CartItem productId is required');
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('CartItem quantity must be a positive integer');
    }

    const rawCreatedAt = createdAt !== undefined && createdAt !== null ? createdAt : created_at;
    const rawUpdatedAt = updatedAt !== undefined && updatedAt !== null ? updatedAt : updated_at;

    this._id = id ?? null;
    this._userId = resolvedUserId.trim();
    this._productId = resolvedProductId.trim();
    this._quantity = quantity;
    this._createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
    this._updatedAt = rawUpdatedAt ? new Date(rawUpdatedAt) : null;

    Object.freeze(this);
  }

  /**
   * @returns {string|null}
   */
  get id() {
    return this._id;
  }

  /**
   * @returns {string}
   */
  get userId() {
    return this._userId;
  }

  /**
   * @returns {string}
   */
  get user_id() {
    return this._userId;
  }

  /**
   * @returns {string}
   */
  get productId() {
    return this._productId;
  }

  /**
   * @returns {string}
   */
  get product_id() {
    return this._productId;
  }

  /**
   * @returns {number}
   */
  get quantity() {
    return this._quantity;
  }

  /**
   * @returns {Date|null}
   */
  get createdAt() {
    return this._createdAt;
  }

  /**
   * @returns {Date|null}
   */
  get created_at() {
    return this._createdAt;
  }

  /**
   * @returns {Date|null}
   */
  get updatedAt() {
    return this._updatedAt;
  }

  /**
   * @returns {Date|null}
   */
  get updated_at() {
    return this._updatedAt;
  }

  /**
   * Returns a new CartItem instance with the specified quantity.
   * Validates newQuantity using the same rule as the constructor,
   * preserves id, userId, productId, and createdAt,
   * and sets updatedAt to a new Date instance.
   * Does NOT mutate this instance.
   *
   * @param {number} newQuantity - The new positive integer quantity (>= 1)
   * @returns {CartItem} A new CartItem instance with the updated quantity
   */
  withQuantity(newQuantity) {
    return new CartItem({
      id: this._id,
      userId: this._userId,
      productId: this._productId,
      quantity: newQuantity,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * @returns {Object} JSON representation of the cart item
   */
  toJSON() {
    return {
      id: this._id,
      userId: this._userId,
      productId: this._productId,
      quantity: this._quantity,
      createdAt: this._createdAt ? this._createdAt.toISOString() : null,
      updatedAt: this._updatedAt ? this._updatedAt.toISOString() : null,
    };
  }
}
