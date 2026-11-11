import { OrderDetailDTO } from '../dtos/OrderDTO.js';

export class GetOrderByIdUseCase {
  /** @param {{ orderRepository: object, profileRepository?: object }} deps */
  constructor({ orderRepository, profileRepository } = {}) {
    if (!orderRepository) {
      throw new Error('orderRepository is required');
    }
    this.orderRepository = orderRepository;
    this.profileRepository = profileRepository;
  }

  /** Buyer, seller (own products), or admin. */
  async execute({ orderId, userId } = {}) {
    if (!orderId || typeof orderId !== 'string') {
      const err = new Error('orderId is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    if (!userId || typeof userId !== 'string') {
      const err = new Error('Authentication failed');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    const roleNames = await this._resolveRoleNames(userId);
    const isAdmin = roleNames.includes('admin');

    if (isAdmin) {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        const err = new Error('Order not found');
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }
      return {
        data: new OrderDetailDTO(order).toJSON(),
        meta: { timestamp: new Date().toISOString() },
      };
    }

    const asBuyer = await this.orderRepository.findById(orderId);
    if (asBuyer && asBuyer.buyerId === userId) {
      return {
        data: new OrderDetailDTO(asBuyer).toJSON(),
        meta: { timestamp: new Date().toISOString() },
      };
    }

    if (!asBuyer) {
      const err = new Error('Order not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const sellerView = await this.orderRepository.findByIdForSeller(orderId, userId);
    if (sellerView) {
      return {
        data: new OrderDetailDTO(sellerView).toJSON(),
        meta: { timestamp: new Date().toISOString() },
      };
    }

    const err = new Error('You do not have permission to access this order');
    err.code = 'FORBIDDEN';
    err.statusCode = 403;
    throw err;
  }

  /**
   * Roles come ONLY from `user_roles` (database). Never from the request or from
   * JWT `user_metadata`, which the user can edit. Without a repository: no roles (fail closed).
   * @private
   */
  async _resolveRoleNames(userId) {
    if (!this.profileRepository?.findById) return [];
    const profile = await this.profileRepository.findById(userId);
    return (profile?.roles || []).map((role) => role?.name).filter(Boolean);
  }
}
