/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { ICartRepository } from '../ICartRepository.js';

class ConcreteCartRepository extends ICartRepository {}

describe('ICartRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new ICartRepository()).toThrow('ICartRepository cannot be instantiated');
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(ICartRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteCartRepository()).toBeInstanceOf(ICartRepository);
  });

  it.each([
    ['findByUserAndProduct', [{ userId: 'user-1', productId: 'product-1' }]],
    ['incrementQuantity', [{ userId: 'user-1', productId: 'product-1', delta: 1 }]],
    ['updateQuantity', [{ userId: 'user-1', productId: 'product-1', quantity: 2 }]],
    ['removeItem', [{ userId: 'user-1', productId: 'product-1' }]],
    ['clearCart', ['user-1']],
    ['clearCart', ['user-1', { transaction: {} }]],
    ['countByUser', ['user-1']],
    ['findById', ['cart-item-1']],
    ['findByUserId', ['user-1']],
    ['findByUserId', ['user-1', { includeProduct: true }]],
    ['findCheckoutLines', ['user-1']],
    ['findCheckoutLines', ['user-1', { transaction: {} }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcreteCartRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
