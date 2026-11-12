export class ClearCartUseCase {
  constructor({ cartRepository } = {}) {
    if (!cartRepository) throw new Error('cartRepository is required');
    this.cartRepository = cartRepository;
  }

  async execute({ userId }) {
    await this.cartRepository.clearCart(userId);
  }
}
