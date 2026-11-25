import { describe, expect, it } from 'vitest';
import { Order } from '../../../domain/entities/Order.js';
import { ListOrdersRequestDTO, OrderDetailDTO, OrderListItemDTO } from '../OrderDTO.js';

describe('ListOrdersRequestDTO', () => {
  it('applies defaults and falls back from userId to buyerId', () => {
    const dto = new ListOrdersRequestDTO({ buyerId: '  buyer-1  ' });

    expect(dto.userId).toBe('buyer-1');
    expect(dto.buyerId).toBe('buyer-1');
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.status).toBeUndefined();
    expect(dto.view).toBe('buyer');
  });

  it('coerces pagination and accepts every supported view', () => {
    const dto = new ListOrdersRequestDTO({
      userId: 'user-1',
      page: '3',
      limit: '',
      status: '  shipped  ',
      view: '  admin  ',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(20);
    expect(dto.status).toBe('shipped');
    expect(dto.view).toBe('admin');
  });

  it('defaults blank views and drops blank statuses', () => {
    const dto = new ListOrdersRequestDTO({ userId: 'user-1', view: '   ', status: '' });

    expect(dto.view).toBe('buyer');
    expect(dto.status).toBeUndefined();
    expect(new ListOrdersRequestDTO({ userId: 'u', page: null, limit: null })).toMatchObject({
      page: 1,
      limit: 20,
    });
  });

  it.each([
    [{}, 'userId is required'],
    [{ userId: 123 }, 'userId is required'],
    [{ userId: 'u', view: 'unknown' }, 'view must be one of: buyer, seller, admin'],
  ])('rejects invalid params %j', (params, message) => {
    expect(() => new ListOrdersRequestDTO(params)).toThrow(TypeError);
    expect(() => new ListOrdersRequestDTO(params)).toThrow(message);
  });
});

describe('Order DTOs', () => {
  const order = new Order({
    id: 'order-1',
    orderNumber: 'ORD-1',
    buyerId: 'buyer-1',
    status: 'pending',
  });

  it.each([
    ['OrderListItemDTO', OrderListItemDTO],
    ['OrderDetailDTO', OrderDetailDTO],
  ])('%s requires an order', (_name, Dto) => {
    expect(() => new Dto()).toThrow('Order entity is required');
  });

  it.each([
    ['OrderListItemDTO', OrderListItemDTO],
    ['OrderDetailDTO', OrderDetailDTO],
  ])('%s accepts a plain object', (_name, Dto) => {
    const dto = new Dto({ id: 'plain-1', total: 5 });

    expect(dto.toJSON()).toMatchObject({ id: 'plain-1', total: 5, items: [] });
  });

  it('serializes an Order entity with all fields', () => {
    expect(new OrderListItemDTO(order).toJSON()).toMatchObject({
      id: 'order-1',
      order_number: 'ORD-1',
      buyer_id: 'buyer-1',
      status: 'pending',
      items: [],
    });
    expect(new OrderDetailDTO(order).toJSON()).toMatchObject({
      id: 'order-1',
      order_number: 'ORD-1',
    });
  });
});
