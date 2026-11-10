import { buildOrderStatusChangedEvent } from '../../domain/events/OrderStatusChanged.js';
import {
  assertTransition,
  timestampColumnForStatus,
} from '../../domain/services/OrderStatusTransitionService.js';
import { OrderDetailDTO } from '../dtos/OrderDTO.js';

export class UpdateOrderStatusUseCase {
  /** @param {{ orderRepository: object, outboxRepository: object, transactionManager: object, profileRepository?: object }} deps */
  constructor({ orderRepository, outboxRepository, transactionManager, profileRepository } = {}) {
    if (!orderRepository) throw new Error('orderRepository is required');
    if (!outboxRepository) throw new Error('outboxRepository is required');
    if (!transactionManager) throw new Error('transactionManager is required');
    this.orderRepository = orderRepository;
    this.outboxRepository = outboxRepository;
    this.transactionManager = transactionManager;
    this.profileRepository = profileRepository;
  }

  /** Transition status, enqueue OrderStatusChanged in the same transaction. */
  async execute({ orderId, userId, nextStatus, userRole = null } = {}) {
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
    if (!nextStatus || typeof nextStatus !== 'string') {
      const err = new Error('status is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const roleNames = await this._resolveRoleNames(userId, userRole);
    const actorRole = await this._resolveActorRole({ order, userId, roleNames });

    const fromStatus = order.status;
    assertTransition(fromStatus, nextStatus, actorRole);

    const timestampColumn = timestampColumnForStatus(nextStatus);

    const updated = await this.transactionManager.run(async (transaction) => {
      const saved = await this.orderRepository.updateStatus({
        orderId,
        status: nextStatus,
        timestampColumn,
        transaction,
      });

      if (!saved) {
        const err = new Error('Order not found');
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      await this.outboxRepository.enqueue(
        buildOrderStatusChangedEvent({
          order: saved,
          fromStatus,
          toStatus: nextStatus,
          changedBy: userId,
        }),
        { transaction }
      );

      return saved;
    });

    return {
      data: new OrderDetailDTO(updated).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }

  /** @private */
  async _resolveRoleNames(userId, roleHint) {
    const names = new Set();
    if (typeof roleHint === 'string' && roleHint.trim()) {
      names.add(roleHint.trim());
    }
    if (this.profileRepository?.findById) {
      const profile = await this.profileRepository.findById(userId);
      for (const role of profile?.roles || []) {
        if (role?.name) names.add(role.name);
      }
    }
    return [...names];
  }

  /** @private Resolve admin | seller | buyer and enforce ownership. */
  async _resolveActorRole({ order, userId, roleNames }) {
    if (roleNames.includes('admin')) {
      return 'admin';
    }

    const isBuyer = order.buyerId === userId;
    const sellerOwns = await this.orderRepository.sellerHasItemsOnOrder(order.id, userId);

    if (sellerOwns) {
      return 'seller';
    }

    if (isBuyer) {
      return 'buyer';
    }

    const err = new Error('You do not have permission to update this order');
    err.code = 'FORBIDDEN';
    err.statusCode = 403;
    throw err;
  }
}
