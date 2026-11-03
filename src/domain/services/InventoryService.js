import { InsufficientStockError } from '../errors/CheckoutErrors.js';

/**
 * Domain service that reserves stock for an order.
 */
export class InventoryService {
  /**
   * @param {Object} deps
   * @param {import('../repositories/IProductRepository.js').IProductRepository} deps.productRepository
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    this.productRepository = productRepository;
  }

  /**
   * @param {Array<{ productId: string, name: string, quantity: number }>} lines
   * @param {Object} [options]
   * @param {*} [options.transaction] Opaque transaction handle of the checkout.
   * @returns {Promise<void>}
   * @throws {InsufficientStockError} for the first product that cannot be served.
   */
  async reserve(lines, { transaction } = {}) {
    const ordered = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));

    for (const line of ordered) {
      const remaining = await this.productRepository.decrementStockIfAvailable(
        { productId: line.productId, quantity: line.quantity },
        { transaction }
      );

      if (remaining === null) {
        throw new InsufficientStockError({ productId: line.productId, productName: line.name });
      }
    }
  }
}
