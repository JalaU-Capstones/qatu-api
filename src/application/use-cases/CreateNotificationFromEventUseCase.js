import { ORDER_PLACED_ROUTING_KEY } from '../../domain/events/OrderPlaced.js';

/** Retrying cannot fix it, so the consumer dead-letters it right away. */
export class InvalidEventPayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEventPayloadError';
    this.permanent = true;
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Turns an `order.placed` event into a buyer notification, idempotent on `eventId`.
 * Other routing keys are acknowledged and ignored.
 */
export class CreateNotificationFromEventUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  async execute({ eventId, routingKey, payload } = {}) {
    if (!isNonEmptyString(eventId)) {
      throw new InvalidEventPayloadError('eventId (messageId) is missing');
    }

    if (routingKey !== ORDER_PLACED_ROUTING_KEY) {
      return { status: 'ignored' };
    }

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
}
