export const RATING_RECEIVED_EVENT_TYPE = 'RatingReceived';
export const RATING_RECEIVED_ROUTING_KEY = 'rating.received';

/** Small payload with no PII; the consumer turns it into a seller notice */
export function buildRatingReceivedEvent({
  ratingId,
  sellerId,
  score,
  productId = null,
  orderId = null,
}) {
  return {
    eventType: RATING_RECEIVED_EVENT_TYPE,
    aggregateType: 'rating',
    aggregateId: ratingId,
    routingKey: RATING_RECEIVED_ROUTING_KEY,
    payload: {
      rating_id: ratingId,
      seller_id: sellerId,
      product_id: productId,
      order_id: orderId,
      score,
    },
  };
}
