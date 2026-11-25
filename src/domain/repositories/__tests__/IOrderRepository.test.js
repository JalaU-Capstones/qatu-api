/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IOrderRepository } from '../IOrderRepository.js';

class ConcreteOrderRepository extends IOrderRepository {}

describe('IOrderRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new IOrderRepository()).toThrow('IOrderRepository cannot be instantiated');
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(IOrderRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteOrderRepository()).toBeInstanceOf(IOrderRepository);
  });

  it.each([
    ['findByBuyerId', []],
    ['findByBuyerId', [{ buyerId: 'buyer-1', page: 2, limit: 5, status: 'shipped' }]],
    ['findBySellerId', []],
    ['findBySellerId', [{ sellerId: 'seller-1', page: 1, limit: 10, status: 'pending' }]],
    ['findAll', []],
    ['findAll', [{ page: 3, limit: 20, status: 'delivered' }]],
    ['findById', ['order-1']],
    ['sellerHasItemsOnOrder', ['order-1', 'seller-1']],
    ['findByIdForSeller', ['order-1', 'seller-1']],
    ['updateStatus', []],
    [
      'updateStatus',
      [
        {
          orderId: 'order-1',
          status: 'shipped',
          timestampColumn: 'shipped_at',
          itemsSellerId: 'seller-1',
          transaction: {},
        },
      ],
    ],
    ['createWithItems', [{ buyerId: 'buyer-1', items: [] }]],
    ['createWithItems', [{ buyerId: 'buyer-1', items: [] }, { transaction: {} }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcreteOrderRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
