import { OrderListItemDTO } from '../dtos/OrderDTO.js';

export class ListOrdersUseCase {
  /**
   * @param {Object} deps
   * @param {import('../../domain/repositories/IOrderRepository.js').IOrderRepository} deps.orderRepository
   */
  constructor({ orderRepository } = {}) {
    if (!orderRepository) {
      throw new Error('orderRepository is required');
    }
    this.orderRepository = orderRepository;
  }

  /**
   * @param {import('../dtos/OrderDTO.js').ListOrdersRequestDTO} requestDto
   * @returns {Promise<{ data: Object[], meta: { page: number, per_page: number, total: number, total_pages: number } }>}
   */
  async execute(requestDto) {
    const { items, total } = await this.orderRepository.findByBuyerId({
      buyerId: requestDto.buyerId,
      page: requestDto.page,
      limit: requestDto.limit,
      status: requestDto.status,
    });

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
}
