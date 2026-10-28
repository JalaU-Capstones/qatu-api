import { OrderDetailDTO } from '../dtos/OrderDTO.js';

export class GetOrderByIdUseCase {
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
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.userId
   * @param {string|null} [params.userRole]
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute({ orderId, userId, userRole = null } = {}) {
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

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Buyers see only their own orders
    if (order.buyerId !== userId && userRole !== 'admin') {
      const err = new Error('You do not have permission to access this order');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    return {
      data: new OrderDetailDTO(order).toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
