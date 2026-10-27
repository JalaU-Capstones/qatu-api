export class RemoveCartItemUseCase {
  constructor({ cartRepository } = {}) {
    if (!cartRepository) throw new Error('cartRepository is required');
    this.cartRepository = cartRepository;
  }

  async execute({ userId, productId }) {
    await this.cartRepository.removeItem({ userId, productId });
  }
}
