export class RemoveCartItemUseCase {
  constructor({ cartRepository }) {
    this.cartRepository = cartRepository;
  }

  /**
   * Executes the remove cart item use case.
   *
   * @param {Object} params
   * @param {string} params.userId - The ID of the authenticated user.
   * @param {string} params.cartItemId - The ID of the cart item to remove.
   */
  async execute({ userId, cartItemId }) {
    const cartItem = await this.cartRepository.findById(cartItemId);

    if (!cartItem || cartItem.userId !== userId) {
      const err = new Error('Cart item not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    await this.cartRepository.removeItem(cartItemId);
  }
}
