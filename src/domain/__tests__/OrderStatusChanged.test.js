import { describe, expect, it } from 'vitest';
import {
  buildOrderStatusChangedEvent,
  ORDER_STATUS_CHANGED_EVENT_TYPE,
  ORDER_STATUS_CHANGED_ROUTING_KEY,
} from '../events/OrderStatusChanged.js';

describe('OrderStatusChanged event (ADR-017: PII-free payload)', () => {
  // An order carrying every kind of PII the aggregate can hold.
  const order = {
    id: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
    orderNumber: 'ORD-00100042',
    buyerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    buyerEmail: 'buyer@example.com',
    buyerName: 'Aaron Florez',
    shippingAddress: { full_name: 'Aaron Florez', phone: '71234567', street: '123 Main St' },
    notes: 'Leave at reception',
  };

  const event = buildOrderStatusChangedEvent({
    order,
    fromStatus: 'confirmed',
    toStatus: 'shipped',
    changedBy: 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22',
  });

  it('uses the order.status_changed routing key on the order aggregate', () => {
    expect(event.eventType).toBe(ORDER_STATUS_CHANGED_EVENT_TYPE);
    expect(event.routingKey).toBe(ORDER_STATUS_CHANGED_ROUTING_KEY);
    expect(event.aggregateType).toBe('order');
    expect(event.aggregateId).toBe(order.id);
  });

  it('carries only identifiers and statuses (allowlist)', () => {
    expect(Object.keys(event.payload).sort()).toEqual([
      'buyer_id',
      'changed_by',
      'from_status',
      'order_id',
      'order_number',
      'to_status',
    ]);
  });

  it('never leaks buyer email, name, address, phone or notes', () => {
    const serialized = JSON.stringify(event.payload);
    for (const pii of [
      'buyer@example.com',
      'Aaron Florez',
      '71234567',
      '123 Main St',
      'reception',
    ]) {
      expect(serialized).not.toContain(pii);
    }
  });
});
