import { ORDER_PLACED_ROUTING_KEY } from '../../domain/events/OrderPlaced.js';
import { ORDER_STATUS_CHANGED_ROUTING_KEY } from '../../domain/events/OrderStatusChanged.js';
import {
  SELLER_APPROVED_ROUTING_KEY,
  SELLER_REJECTED_ROUTING_KEY,
} from '../../domain/events/SellerApplicationReviewed.js';

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

    if (routingKey === SELLER_APPROVED_ROUTING_KEY) {
      return this._handleSellerApproved(eventId, payload);
    }

    if (routingKey === SELLER_REJECTED_ROUTING_KEY) {
      return this._handleSellerRejected(eventId, payload);
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

  /** @private */
  async _handleSellerApproved(eventId, payload) {
    const { application_id, profile_id } = payload || {};
    if (!isNonEmptyString(application_id) || !isNonEmptyString(profile_id)) {
      throw new InvalidEventPayloadError('seller_application.approved payload is incomplete');
    }

    const inserted = await this.notificationRepository.createFromEvent({
      eventId,
      profileId: profile_id,
      type: 'seller_approved',
      title: 'Solicitud de vendedor aprobada',
      body: '¡Felicitaciones! Tu solicitud para vender en Qatu fue aprobada. Ya puedes publicar productos.',
      actionUrl: '/seller/products',
      payload: { application_id },
    });

    return { status: inserted ? 'created' : 'duplicate' };
  }

  /** @private */
  async _handleSellerRejected(eventId, payload) {
    const { application_id, profile_id, rejection_reason } = payload || {};
    if (!isNonEmptyString(application_id) || !isNonEmptyString(profile_id)) {
      throw new InvalidEventPayloadError('seller_application.rejected payload is incomplete');
    }

    const reasonText = isNonEmptyString(rejection_reason) ? ` Motivo: ${rejection_reason}` : '';

    const inserted = await this.notificationRepository.createFromEvent({
      eventId,
      profileId: profile_id,
      type: 'seller_rejected',
      title: 'Solicitud de vendedor rechazada',
      body: `Tu solicitud para convertirte en vendedor no fue aprobada.${reasonText}`,
      actionUrl: '/seller/apply',
      payload: { application_id, rejection_reason: rejection_reason || null },
    });

    return { status: inserted ? 'created' : 'duplicate' };
  }
}
