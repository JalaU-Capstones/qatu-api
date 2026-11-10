import { ORDER_PLACED_ROUTING_KEY } from '../../domain/events/OrderPlaced.js';
import { ORDER_STATUS_CHANGED_ROUTING_KEY } from '../../domain/events/OrderStatusChanged.js';

/** Permanent payload error → DLQ (no retry). */
export class InvalidEventPayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEventPayloadError';
    this.permanent = true;
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const STATUS_LABELS = Object.freeze({
  pending: 'pendiente',
  confirmed: 'confirmado',
  shipped: 'enviado',
  delivered: 'entregado',
  cancelled: 'cancelado',
});

/** Maps order.* events to buyer notifications (idempotent on eventId). */
export class CreateNotificationFromEventUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  async execute({ eventId, routingKey, payload } = {}) {
    if (!isNonEmptyString(eventId)) {
      throw new InvalidEventPayloadError('eventId (messageId) is missing');
    }

    if (routingKey === ORDER_PLACED_ROUTING_KEY) {
      return this._handleOrderPlaced(eventId, payload);
    }

    if (routingKey === ORDER_STATUS_CHANGED_ROUTING_KEY) {
      return this._handleOrderStatusChanged(eventId, payload);
    }

    return { status: 'ignored' };
  }

  /** @private */
  async _handleOrderPlaced(eventId, payload) {
    const { order_id, order_number, buyer_id, total, currency } = payload || {};
    if (
      !isNonEmptyString(order_id) ||
      !isNonEmptyString(order_number) ||
      !isNonEmptyString(buyer_id)
    ) {
      throw new InvalidEventPayloadError('order.placed payload is incomplete');
    }

    const inserted = await this.notificationRepository.createFromEvent({
      eventId,
      profileId: buyer_id,
      type: 'order_placed',
      title: 'Pedido realizado',
      body: `Tu pedido ${order_number} fue registrado correctamente.`,
      actionUrl: '/orders',
      payload: { order_id, order_number, total, currency },
    });

    return { status: inserted ? 'created' : 'duplicate' };
  }

  /** @private */
  async _handleOrderStatusChanged(eventId, payload) {
    const { order_id, order_number, buyer_id, from_status, to_status, changed_by } = payload || {};
    if (
      !isNonEmptyString(order_id) ||
      !isNonEmptyString(buyer_id) ||
      !isNonEmptyString(from_status) ||
      !isNonEmptyString(to_status)
    ) {
      throw new InvalidEventPayloadError('order.status_changed payload is incomplete');
    }

    const label = STATUS_LABELS[to_status] || to_status;
    const numberPart = isNonEmptyString(order_number) ? ` ${order_number}` : '';

    const inserted = await this.notificationRepository.createFromEvent({
      eventId,
      profileId: buyer_id,
      type: 'order_status_changed',
      title: 'Estado del pedido actualizado',
      body: `Tu pedido${numberPart} ahora está ${label}.`,
      actionUrl: '/orders',
      payload: { order_id, order_number, from_status, to_status, changed_by },
    });

    return { status: inserted ? 'created' : 'duplicate' };
  }
}
