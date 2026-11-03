import { describe, expect, it } from 'vitest';
import { Order } from '../entities/Order.js';
import {
  buildOrderPlacedEvent,
  ORDER_PLACED_EVENT_TYPE,
  ORDER_PLACED_ROUTING_KEY,
} from '../events/OrderPlaced.js';

describe('buildOrderPlacedEvent', () => {
  const order = new Order({
    id: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
    orderNumber: 'ORD-00100042',
    buyerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    currency: 'USD',
    subtotal: 40,
    shippingCost: 4.99,
    tax: 0,
    total: 44.99,
    shippingAddress: { street: '123 Main St', city: 'La Paz', country: 'BO' },
    items: [
      { orderId: 'o', productName: 'A', quantity: 1, unitPrice: 20 },
      { orderId: 'o', productName: 'B', quantity: 1, unitPrice: 20 },
    ],
  });

  it('uses the contract event type and routing key', () => {
    const event = buildOrderPlacedEvent({ order, sellerIds: ['s1'] });

    expect(event.eventType).toBe(ORDER_PLACED_EVENT_TYPE);
    expect(event.routingKey).toBe(ORDER_PLACED_ROUTING_KEY);
    expect(event.routingKey).toBe('order.placed');
    expect(event.aggregateType).toBe('order');
    expect(event.aggregateId).toBe(order.id);
  });

  it('builds a minimal payload with de-duplicated seller ids', () => {
    const { payload } = buildOrderPlacedEvent({ order, sellerIds: ['s1', 's2', 's1'] });

    expect(payload).toEqual({
      order_id: order.id,
      order_number: 'ORD-00100042',
      buyer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      total: 44.99,
      currency: 'USD',
      item_count: 2,
      seller_ids: ['s1', 's2'],
    });
  });

  it('never leaks PII such as the shipping address into the payload', () => {
    const { payload } = buildOrderPlacedEvent({ order, sellerIds: [] });

    expect(JSON.stringify(payload)).not.toMatch(/Main St|La Paz|address|email/i);
  });
});
