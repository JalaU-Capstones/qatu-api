export const ORDER_STATUS_CHANGED_EVENT_TYPE = 'OrderStatusChanged';
export const ORDER_STATUS_CHANGED_ROUTING_KEY = 'order.status_changed';

/**
 * Minimal, PII-free `OrderStatusChanged` payload.
 *
 * @param {Object} params
 * @param {import('../entities/Order.js').Order} params.order
 * @param {string} params.fromStatus
 * @param {string} params.toStatus
 * @param {string} params.changedBy
 */
export function buildOrderStatusChangedEvent({ order, fromStatus, toStatus, changedBy }) {
  return {
    eventType: ORDER_STATUS_CHANGED_EVENT_TYPE,
    aggregateType: 'order',
    aggregateId: order.id,
    routingKey: ORDER_STATUS_CHANGED_ROUTING_KEY,
    payload: {
      order_id: order.id,
      order_number: order.orderNumber,
      from_status: fromStatus,
      to_status: toStatus,
      buyer_id: order.buyerId,
      changed_by: changedBy,
    },
  };
}
