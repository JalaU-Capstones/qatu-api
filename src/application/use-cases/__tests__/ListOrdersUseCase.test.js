import { describe, it, expect, vi } from 'vitest';
import { Order } from '../../../domain/entities/Order.js';
import { ListOrdersRequestDTO } from '../../dtos/OrderDTO.js';
import { ListOrdersUseCase } from '../ListOrdersUseCase.js';

describe('ListOrdersUseCase', () => {
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('throws error when orderRepository is missing', () => {
    expect(() => new ListOrdersUseCase()).toThrow('orderRepository is required');
  });

  it('Scenario: View own orders - returns paginated orders', async () => {
    const mockOrder = new Order({
      id: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
      orderNumber: 'ORD-00100042',
      buyerId,
      status: 'pending',
      currency: 'USD',
      total: 100,
      createdAt: '2026-10-14T11:00:00.000Z',
    });

    const mockOrderRepo = {
      findByBuyerId: vi.fn().mockResolvedValue({
        items: [mockOrder],
        total: 1,
      }),
    };

    const useCase = new ListOrdersUseCase({ orderRepository: mockOrderRepo });
    const requestDto = new ListOrdersRequestDTO({ buyerId, page: 1, limit: 10 });

    const result = await useCase.execute(requestDto);

    expect(mockOrderRepo.findByBuyerId).toHaveBeenCalledWith({
      buyerId,
      page: 1,
      limit: 10,
      status: undefined,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a');
    expect(result.data[0].order_number).toBe('ORD-00100042');
    expect(result.data[0].status).toBe('pending');
    expect(result.data[0].total).toBe(100);
    expect(result.meta).toEqual({
      page: 1,
      per_page: 10,
      total: 1,
      total_pages: 1,
    });
  });

  it('Scenario: No orders - returns empty list and total_pages 0', async () => {
    const mockOrderRepo = {
      findByBuyerId: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    };

    const useCase = new ListOrdersUseCase({ orderRepository: mockOrderRepo });
    const requestDto = new ListOrdersRequestDTO({ buyerId, page: 1, limit: 20 });

    const result = await useCase.execute(requestDto);

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 1,
      per_page: 20,
      total: 0,
      total_pages: 0,
    });
  });

  it('calculates total_pages correctly across multiple pages', async () => {
    const mockOrderRepo = {
      findByBuyerId: vi.fn().mockResolvedValue({
        items: [],
        total: 25,
      }),
    };

    const useCase = new ListOrdersUseCase({ orderRepository: mockOrderRepo });
    const requestDto = new ListOrdersRequestDTO({ buyerId, page: 2, limit: 10 });

    const result = await useCase.execute(requestDto);
    expect(result.meta.total_pages).toBe(3);
  });
});
