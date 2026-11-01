import { describe, it, expect, vi } from 'vitest';
import { Order } from '../../../domain/entities/Order.js';
import { GetOrderByIdUseCase } from '../GetOrderByIdUseCase.js';

describe('GetOrderByIdUseCase', () => {
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const otherBuyerId = 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22';
  const orderId = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

  const mockOrder = new Order({
    id: orderId,
    orderNumber: 'ORD-00100042',
    buyerId,
    status: 'pending',
    currency: 'USD',
    total: 100,
  });

  it('throws error when orderRepository is missing', () => {
    expect(() => new GetOrderByIdUseCase()).toThrow('orderRepository is required');
  });

  it('throws 400 when orderId is missing', async () => {
    const useCase = new GetOrderByIdUseCase({ orderRepository: {} });
    await expect(useCase.execute({ orderId: '', userId: buyerId })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws 401 when userId is missing', async () => {
    const useCase = new GetOrderByIdUseCase({ orderRepository: {} });
    await expect(useCase.execute({ orderId, userId: '' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('throws 404 when order does not exist', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const useCase = new GetOrderByIdUseCase({ orderRepository: mockRepo });

    await expect(useCase.execute({ orderId, userId: buyerId })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('Scenario: Cannot see other buyers orders - throws 403 Forbidden', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(mockOrder),
    };
    const useCase = new GetOrderByIdUseCase({ orderRepository: mockRepo });

    await expect(useCase.execute({ orderId, userId: otherBuyerId })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this order',
    });
  });

  it('returns order details when user is the owner', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(mockOrder),
    };
    const useCase = new GetOrderByIdUseCase({ orderRepository: mockRepo });

    const result = await useCase.execute({ orderId, userId: buyerId });
    expect(result.data.id).toBe(orderId);
    expect(result.data.order_number).toBe('ORD-00100042');
  });

  it('allows admin to view another buyers order', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(mockOrder),
    };
    const useCase = new GetOrderByIdUseCase({ orderRepository: mockRepo });

    const result = await useCase.execute({
      orderId,
      userId: otherBuyerId,
      userRole: 'admin',
    });
    expect(result.data.id).toBe(orderId);
  });
});
