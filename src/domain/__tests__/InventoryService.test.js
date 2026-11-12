import { describe, expect, it, vi } from 'vitest';
import { InsufficientStockError } from '../errors/CheckoutErrors.js';
import { InventoryService } from '../services/InventoryService.js';

describe('InventoryService', () => {
  const tx = { id: 'tx-1' };

  it('requires a product repository', () => {
    expect(() => new InventoryService()).toThrow('productRepository is required');
  });

  it('reserves every line inside the given transaction', async () => {
    const productRepository = { decrementStockIfAvailable: vi.fn().mockResolvedValue(3) };
    const service = new InventoryService({ productRepository });

    await service.reserve([{ productId: 'a', name: 'A', quantity: 2 }], { transaction: tx });

    expect(productRepository.decrementStockIfAvailable).toHaveBeenCalledWith(
      { productId: 'a', quantity: 2 },
      { transaction: tx }
    );
  });

  it('processes products in ascending id order so concurrent checkouts cannot deadlock', async () => {
    const calls = [];
    const productRepository = {
      decrementStockIfAvailable: vi.fn(async ({ productId }) => {
        calls.push(productId);
        return 1;
      }),
    };
    const service = new InventoryService({ productRepository });

    await service.reserve(
      [
        { productId: 'c', name: 'C', quantity: 1 },
        { productId: 'a', name: 'A', quantity: 1 },
        { productId: 'b', name: 'B', quantity: 1 },
      ],
      { transaction: tx }
    );

    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('throws InsufficientStockError naming the product and stops at the first failure', async () => {
    const productRepository = {
      decrementStockIfAvailable: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(null),
    };
    const service = new InventoryService({ productRepository });

    const promise = service.reserve(
      [
        { productId: 'a', name: 'Alpha', quantity: 1 },
        { productId: 'b', name: 'Beta', quantity: 9 },
        { productId: 'c', name: 'Gamma', quantity: 1 },
      ],
      { transaction: tx }
    );

    await expect(promise).rejects.toMatchObject({
      statusCode: 422,
      code: 'INSUFFICIENT_STOCK',
      message: 'Insufficient stock for Beta',
      details: [{ field: 'items.b', message: 'Insufficient stock for Beta' }],
    });
    await expect(promise).rejects.toBeInstanceOf(InsufficientStockError);
    expect(productRepository.decrementStockIfAvailable).toHaveBeenCalledTimes(2);
  });
});
