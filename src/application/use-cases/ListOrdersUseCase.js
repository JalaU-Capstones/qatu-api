import { OrderListItemDTO } from '../dtos/OrderDTO.js';

export class ListOrdersUseCase {
  /** @param {{ orderRepository: object, profileRepository?: object }} deps */
  constructor({ orderRepository, profileRepository } = {}) {
    if (!orderRepository) {
      throw new Error('orderRepository is required');
    }
    this.orderRepository = orderRepository;
    this.profileRepository = profileRepository;
  }

  /** Lists orders for `view=buyer|seller|admin`. */
  async execute(requestDto) {
    const view = requestDto.view || 'buyer';
    const roleNames = await this._resolveRoleNames(requestDto.userId);

    let result;
    if (view === 'admin') {
      if (!roleNames.includes('admin')) {
        const err = new Error('Admin role required');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
      result = await this.orderRepository.findAll({
        page: requestDto.page,
        limit: requestDto.limit,
        status: requestDto.status,
      });
    } else if (view === 'seller') {
      if (!roleNames.includes('seller') && !roleNames.includes('admin')) {
        const err = new Error('Seller role required');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
      result = await this.orderRepository.findBySellerId({
        sellerId: requestDto.userId,
        page: requestDto.page,
        limit: requestDto.limit,
        status: requestDto.status,
      });
    } else {
      result = await this.orderRepository.findByBuyerId({
        buyerId: requestDto.userId,
        page: requestDto.page,
        limit: requestDto.limit,
        status: requestDto.status,
      });
    }

    const { items, total } = result;
    const totalPages = total === 0 ? 0 : Math.ceil(total / requestDto.limit);

    return {
      data: items.map((order) => new OrderListItemDTO(order).toJSON()),
      meta: {
        page: requestDto.page,
        per_page: requestDto.limit,
        total,
        total_pages: totalPages,
      },
    };
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
