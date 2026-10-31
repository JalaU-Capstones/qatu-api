// eslint-disable-next-line no-unused-vars
import { CartItem } from '../../domain/entities/CartItem.js';
import { CartItemDTO, GetCartRequestDTO } from '../dtos/GetCartDTO.js';

export class GetCartUseCase {
  /**
   * @param {Object} deps
   * @param {import('../../domain/repositories/ICartRepository.js').ICartRepository} deps.cartRepository
   */
  constructor({ cartRepository } = {}) {
    if (!cartRepository) throw new Error('cartRepository is required');
    this.cartRepository = cartRepository;
  }

  /**
   * Returns the authenticated user's cart items ordered oldest first, with the
   * referenced product populated (see the OpenAPI `CartItem.product` field).
   *
   * @param {Object} params
   * @param {string|import('../dtos/GetCartDTO.js').GetCartRequestDTO} [params.userId]
   * @returns {Promise<Array>} Array of snake_case CartItem JSON objects
   */
  async execute({ userId } = {}) {
    const requestDto =
      userId instanceof GetCartRequestDTO ? userId : new GetCartRequestDTO({ userId });

    const rows = await this.cartRepository.findByUserId(requestDto.userId);

    return rows.map((row) => this._toCartItemDTO(row).toJSON());
  }

  /**
   * Builds a CartItemDTO from a joined cart item + product row.
   *
   * @param {Object} row
   * @returns {CartItemDTO}
   * @private
   */
  _toCartItemDTO(row) {
    return new CartItemDTO({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      quantity: Number(row.quantity),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      product: this._toProductJSON(row),
    });
  }

  /**
   * Maps the aliased product columns of a joined row to the OpenAPI
   * `Product` schema shape.
   *
   * @param {Object} row
   * @returns {Object|null}
   * @private
   */
  _toProductJSON(row) {
    if (!row.product_name) return null;

    return {
      id: row.product_id,
      seller_id: row.product_seller_id ?? null,
      category_id: row.product_category_id ?? null,
      name: row.product_name,
      slug: row.product_slug,
      description: row.product_description ?? null,
      price: row.product_price !== undefined ? Number(row.product_price) : 0,
      currency: row.product_currency || 'USD',
      stock: row.product_stock !== undefined ? Number(row.product_stock) : 0,
      attributes: row.product_attributes ?? {},
      primary_image_path: row.product_primary_image_path ?? null,
      state: row.product_state || 'draft',
      average_rating:
        row.product_average_rating !== undefined ? Number(row.product_average_rating) : 0,
      ratings_count:
        row.product_ratings_count !== undefined ? Number(row.product_ratings_count) : 0,
      published_at: row.product_published_at
        ? new Date(row.product_published_at).toISOString()
        : null,
      created_at: row.product_created_at ? new Date(row.product_created_at).toISOString() : null,
      updated_at: row.product_updated_at ? new Date(row.product_updated_at).toISOString() : null,
    };
  }
}
