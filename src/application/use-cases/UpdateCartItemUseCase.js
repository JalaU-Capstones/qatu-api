export class UpdateCartItemUseCase {
  constructor({ cartRepository, productRepository } = {}) {
    if (!cartRepository) throw new Error('cartRepository is required');
    if (!productRepository) throw new Error('productRepository is required');
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
  }

  async execute({ userId, productId, quantity }) {
    if (quantity === 0) {
      await this.cartRepository.removeItem({ userId, productId });
      return null;
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      const err = new Error('Product not found');
      err.code = 'PRODUCT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (quantity > product.stock) {
      const err = new Error(`Insufficient stock. Only ${product.stock} available.`);
      err.code = 'INSUFFICIENT_STOCK';
      err.statusCode = 422;
      throw err;
    }

    const updatedItem = await this.cartRepository.updateQuantity({ userId, productId, quantity });
    if (!updatedItem) {
      const err = new Error('Cart item not found');
      err.code = 'CART_ITEM_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return updatedItem;
  }
}
