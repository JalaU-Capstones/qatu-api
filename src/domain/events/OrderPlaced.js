export const ORDER_PLACED_EVENT_TYPE = 'OrderPlaced';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';

/** Minimal, PII-free `OrderPlaced` payload: identifiers and an order summary only. */
export function buildOrderPlacedEvent({ order, sellerIds }) {
  return {
    eventType: ORDER_PLACED_EVENT_TYPE,
    aggregateType: 'order',
    aggregateId: order.id,
    routingKey: ORDER_PLACED_ROUTING_KEY,
    payload: {
      order_id: order.id,
      order_number: order.orderNumber,
      buyer_id: order.buyerId,
      total: order.total,
      currency: order.currency,
      item_count: order.items.length,
      seller_ids: [...new Set(sellerIds)],
    },
  };
}
