import { MESSAGE_SENT_ROUTING_KEY } from '../../domain/events/MessageSent.js';
import { ORDER_PLACED_ROUTING_KEY } from '../../domain/events/OrderPlaced.js';
import { ORDER_STATUS_CHANGED_ROUTING_KEY } from '../../domain/events/OrderStatusChanged.js';
import { RATING_RECEIVED_ROUTING_KEY } from '../../domain/events/RatingReceived.js';
import {
  SELLER_APPROVED_ROUTING_KEY,
  SELLER_REJECTED_ROUTING_KEY,
} from '../../domain/events/SellerApplicationReviewed.js';

/** Invalid payload, sent to DLQ with no retry */
export class InvalidEventPayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEventPayloadError';
    this.permanent = true;
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const STATUS_LABELS = new Map([
  ['pending', 'pendiente'],
  ['confirmed', 'confirmado'],
  ['shipped', 'enviado'],
  ['delivered', 'entregado'],
  ['cancelled', 'cancelado'],
]);

const STATUS_TITLES = new Map([
  ['pending', 'Pedido pendiente'],
  ['confirmed', 'Pedido confirmado'],
  ['shipped', 'Pedido enviado'],
  ['delivered', 'Pedido entregado'],
  ['cancelled', 'Pedido cancelado'],
]);

const SELLER_ORDERS_URL = '/seller/orders';

const buyerOrderUrl = (orderNumber) =>
  isNonEmptyString(orderNumber) ? `/orders/${encodeURIComponent(orderNumber)}` : '/orders';

const uniqueIds = (ids, exclude = []) =>
  [...new Set((Array.isArray(ids) ? ids : []).filter(isNonEmptyString))].filter(
    (id) => !exclude.includes(id)
  );

/** One notice per event and person, skip if it was already processed */
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

    if (routingKey === MESSAGE_SENT_ROUTING_KEY) {
      return this._handleMessageSent(eventId, payload);
    }

    if (routingKey === RATING_RECEIVED_ROUTING_KEY) {
      return this._handleRatingReceived(eventId, payload);
    }

    return { status: 'ignored' };
  }

  /** created if someone got a new row, duplicate if they were already there */
  async _notifyAll(eventId, notifications) {
    let created = 0;
    for (const notification of notifications) {
      const inserted = await this.notificationRepository.createFromEvent({
        eventId,
        ...notification,
      });
      if (inserted) created += 1;
    }
    return { status: created > 0 ? 'created' : 'duplicate' };
  }

  async _handleOrderPlaced(eventId, payload) {
    const { order_id, order_number, buyer_id, total, currency, seller_ids } = payload || {};
    if (
      !isNonEmptyString(order_id) ||
      !isNonEmptyString(order_number) ||
      !isNonEmptyString(buyer_id)
    ) {
      throw new InvalidEventPayloadError('order.placed payload is incomplete');
    }

    const buyerNotification = {
      profileId: buyer_id,
      type: 'order_placed',
      title: 'Pedido realizado',
      body: `Tu pedido ${order_number} fue registrado correctamente.`,
      actionUrl: buyerOrderUrl(order_number),
      payload: { order_id, order_number, total, currency },
    };

    const sellerNotifications = uniqueIds(seller_ids, [buyer_id]).map((sellerId) => ({
      profileId: sellerId,
      type: 'order_placed',
      title: 'Nuevo pedido recibido',
      body: `Recibiste el pedido ${order_number} con productos de tu tienda.`,
      actionUrl: SELLER_ORDERS_URL,
      payload: { order_id, order_number },
    }));

    return this._notifyAll(eventId, [buyerNotification, ...sellerNotifications]);
  }

  /** Notify everyone except the person who made the change */
  async _handleOrderStatusChanged(eventId, payload) {
    const { order_id, order_number, buyer_id, from_status, to_status, changed_by, seller_ids } =
      payload || {};
    if (
      !isNonEmptyString(order_id) ||
      !isNonEmptyString(buyer_id) ||
      !isNonEmptyString(from_status) ||
      !isNonEmptyString(to_status)
    ) {
      throw new InvalidEventPayloadError('order.status_changed payload is incomplete');
    }

    const label = STATUS_LABELS.get(to_status) || to_status;
    const title = STATUS_TITLES.get(to_status) || 'Estado del pedido actualizado';
    const numberPart = isNonEmptyString(order_number) ? ` ${order_number}` : '';
    const eventPayload = { order_id, order_number, from_status, to_status, changed_by };
    const notifications = [];

    if (changed_by !== buyer_id) {
      notifications.push({
        profileId: buyer_id,
        type: 'order_status_changed',
        title,
        body: `Tu pedido${numberPart} ahora está ${label}.`,
        actionUrl: buyerOrderUrl(order_number),
        payload: eventPayload,
      });
    }

    const sellerBody =
      changed_by === buyer_id && to_status === 'cancelled'
        ? `El comprador canceló el pedido${numberPart}.`
        : `El pedido${numberPart} ahora está ${label}.`;

    for (const sellerId of uniqueIds(seller_ids, [changed_by, buyer_id])) {
      notifications.push({
        profileId: sellerId,
        type: 'order_status_changed',
        title,
        body: sellerBody,
        actionUrl: SELLER_ORDERS_URL,
        payload: eventPayload,
      });
    }

    if (notifications.length === 0) {
      return { status: 'ignored' };
    }

    return this._notifyAll(eventId, notifications);
  }

  async _handleSellerApproved(eventId, payload) {
    const { application_id, profile_id } = payload || {};
    if (!isNonEmptyString(application_id) || !isNonEmptyString(profile_id)) {
      throw new InvalidEventPayloadError('seller_application.approved payload is incomplete');
    }

    return this._notifyAll(eventId, [
      {
        profileId: profile_id,
        type: 'seller_approved',
        title: 'Solicitud de vendedor aprobada',
        body: '¡Felicitaciones! Tu solicitud para vender en Qatu fue aprobada. Ya puedes publicar productos.',
        actionUrl: '/seller/products',
        payload: { application_id },
      },
    ]);
  }

  async _handleSellerRejected(eventId, payload) {
    const { application_id, profile_id, rejection_reason } = payload || {};
    if (!isNonEmptyString(application_id) || !isNonEmptyString(profile_id)) {
      throw new InvalidEventPayloadError('seller_application.rejected payload is incomplete');
    }

    const reasonText = isNonEmptyString(rejection_reason) ? ` Motivo: ${rejection_reason}` : '';

    return this._notifyAll(eventId, [
      {
        profileId: profile_id,
        type: 'seller_rejected',
        title: 'Solicitud de vendedor rechazada',
        body: `Tu solicitud para convertirte en vendedor no fue aprobada.${reasonText}`,
        actionUrl: '/seller/apply',
        payload: { application_id, rejection_reason: rejection_reason || null },
      },
    ]);
  }

  /** The recipient can be a buyer, a seller or an admin */
  async _handleMessageSent(eventId, payload) {
    const { message_id, conversation_id, sender_id, recipient_id, product_id } = payload || {};
    if (
      !isNonEmptyString(message_id) ||
      !isNonEmptyString(conversation_id) ||
      !isNonEmptyString(sender_id) ||
      !isNonEmptyString(recipient_id)
    ) {
      throw new InvalidEventPayloadError('message.sent payload is incomplete');
    }

    return this._notifyAll(eventId, [
      {
        profileId: recipient_id,
        type: 'message_received',
        title: 'Nuevo mensaje recibido',
        body: 'Tienes un mensaje nuevo en tus conversaciones de Qatu.',
        actionUrl: `/conversations?active=${encodeURIComponent(conversation_id)}`,
        payload: {
          message_id,
          conversation_id,
          sender_id,
          product_id: product_id || null,
        },
      },
    ]);
  }

  async _handleRatingReceived(eventId, payload) {
    const { rating_id, seller_id, product_id, order_id, score } = payload || {};
    const numericScore = Number(score);
    if (
      !isNonEmptyString(rating_id) ||
      !isNonEmptyString(seller_id) ||
      !Number.isInteger(numericScore) ||
      numericScore < 1 ||
      numericScore > 5
    ) {
      throw new InvalidEventPayloadError('rating.received payload is incomplete');
    }

    const target = isNonEmptyString(product_id) ? 'uno de tus productos' : 'tu tienda';

    return this._notifyAll(eventId, [
      {
        profileId: seller_id,
        type: 'rating_received',
        title: 'Nueva calificación recibida',
        body: `Recibiste una calificación de ${numericScore} de 5 estrellas para ${target}.`,
        actionUrl: null,
        payload: {
          rating_id,
          product_id: product_id || null,
          order_id: order_id || null,
          score: numericScore,
        },
      },
    ]);
  }
}
