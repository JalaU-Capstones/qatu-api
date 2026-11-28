import { describe, expect, it } from 'vitest';
import {
  buildRatingReceivedEvent,
  RATING_RECEIVED_EVENT_TYPE,
  RATING_RECEIVED_ROUTING_KEY,
} from '../events/RatingReceived.js';

describe('RatingReceived event', () => {
  it('builds a PII-free outbox event addressed to the seller', () => {
    const event = buildRatingReceivedEvent({
      ratingId: 'r-1',
      sellerId: 's-1',
      score: 5,
      productId: 'p-1',
      orderId: 'o-1',
    });

    expect(event).toEqual({
      eventType: RATING_RECEIVED_EVENT_TYPE,
      aggregateType: 'rating',
      aggregateId: 'r-1',
      routingKey: RATING_RECEIVED_ROUTING_KEY,
      payload: {
        rating_id: 'r-1',
        seller_id: 's-1',
        product_id: 'p-1',
        order_id: 'o-1',
        score: 5,
      },
    });
  });

  it('defaults product and order to null for a seller rating', () => {
    const event = buildRatingReceivedEvent({ ratingId: 'r-2', sellerId: 's-1', score: 3 });

    expect(event.routingKey).toBe('rating.received');
    expect(event.payload).toMatchObject({ product_id: null, order_id: null });
  });
});
