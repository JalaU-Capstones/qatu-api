// eslint-disable-next-line no-unused-vars
import { AddToCartRequestDTO, AddToCartResponseDTO } from '../dtos/AddToCartDTO.js';

export class AddToCartUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../domain/repositories/ICartRepository.js').ICartRepository} dependencies.cartRepository
   * @param {import('../../domain/repositories/IProductRepository.js').IProductRepository} dependencies.productRepository
   */
  constructor({ cartRepository, productRepository } = {}) {
    if (!cartRepository) {
      throw new Error('cartRepository is required');
    }
    if (!productRepository) {
      throw new Error('productRepository is required');
    }
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
  }

  /**
   * Internal helper to fetch a product by id.
   * Calls findById on productRepository if available, or falls back to direct query on productRepository.db.
   *
   * @param {string} productId
   * @returns {Promise<Object|null>}
   * @private
   */
  async _fetchProduct(productId) {
    if (typeof this.productRepository.findById === 'function') {
      return this.productRepository.findById(productId);
    }

    if (this.productRepository.db) {
      const [rows] = await this.productRepository.db.query(
        `SELECT id, seller_id, category_id, name, slug, description, price, currency,
                stock, attributes, primary_image_path, state, average_rating, ratings_count,
                published_at, deleted_at, created_at, updated_at
         FROM public.products
         WHERE id = :id
         LIMIT 1`,
        {
          replacements: { id: productId },
        }
      );

      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row) return null;

      if (typeof this.productRepository.toDomain === 'function') {
        const entity = this.productRepository.toDomain(row);
        if (row.deleted_at && !entity.deleted_at) {
          entity.deleted_at = row.deleted_at;
        }
        return entity;
      }
      return row;
    }

    return null;
  }

  /**
   * Orchestrates the business rules for adding an item to a user's shopping cart.
   *
   * @param {AddToCartRequestDTO} requestDto
   * @returns {Promise<AddToCartResponseDTO>}
   */
  async execute(requestDto) {
    const { userId, productId, quantity: delta } = requestDto;

    const product = await this._fetchProduct(productId);

    if (!product || product.deletedAt || product.deleted_at) {
      const err = new Error('Product not found');
      err.code = 'PRODUCT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (product.state !== 'published') {
      const err = new Error('Product is not available for purchase');
      err.code = 'PRODUCT_NOT_AVAILABLE';
      err.statusCode = 422;
      throw err;
    }

    const existing = await this.cartRepository.findByUserAndProduct({ userId, productId });
    const currentQuantity = existing ? existing.quantity : 0;

    if (product.stock === 0) {
      const err = new Error('Product out of stock');
      err.code = 'PRODUCT_OUT_OF_STOCK';
      err.statusCode = 422;
      throw err;
    } else if (currentQuantity + delta > product.stock) {
      const remaining = product.stock - currentQuantity;
      const err = new Error(
        remaining > 0
          ? `Insufficient stock. You already have ${currentQuantity} in your cart; only ${remaining} more available.`
          : 'Product out of stock'
      );
      err.code = 'INSUFFICIENT_STOCK';
      err.statusCode = 422;
      throw err;
    }

    const updatedItem = await this.cartRepository.incrementQuantity({ userId, productId, delta });
    const itemCount = await this.cartRepository.countByUser(userId);

    return new AddToCartResponseDTO({ item: updatedItem, itemCount });
  }
}
