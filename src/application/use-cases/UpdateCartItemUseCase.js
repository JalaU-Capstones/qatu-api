export class UpdateCartItemUseCase {
  constructor({ cartRepository, productRepository }) {
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
  }

  /**
   * Executes the update cart item use case.
   *
   * @param {Object} params
   * @param {string} params.userId - The ID of the authenticated user.
   * @param {string} params.cartItemId - The ID of the cart item to update.
   * @param {number} params.quantity - The new quantity to set.
   */
  async execute({ userId, cartItemId, quantity }) {
    const cartItem = await this.cartRepository.findById(cartItemId);

    if (!cartItem || cartItem.userId !== userId) {
      const err = new Error('Cart item not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (quantity === 0) {
      await this.cartRepository.removeItem(cartItemId);
      return null;
    }

    const product = await this.productRepository.findById(cartItem.productId);
    if (!product) {
      const err = new Error('Product no longer available');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (quantity > product.stock) {
      const err = new Error(`Insufficient stock. Only ${product.stock} available.`);
      err.code = 'INSUFFICIENT_STOCK';
      err.statusCode = 422;
      throw err;
    }

    return this.cartRepository.updateQuantity({ id: cartItemId, quantity });
  }
}
