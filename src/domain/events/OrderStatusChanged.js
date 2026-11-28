export const ORDER_STATUS_CHANGED_EVENT_TYPE = 'OrderStatusChanged';
export const ORDER_STATUS_CHANGED_ROUTING_KEY = 'order.status_changed';

/** Small payload with no PII; sellerIds also get the notice */
export function buildOrderStatusChangedEvent({
  order,
  fromStatus,
  toStatus,
  changedBy,
  sellerIds = [],
}) {
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
      seller_ids: [...new Set(sellerIds)],
    },
  };
}
