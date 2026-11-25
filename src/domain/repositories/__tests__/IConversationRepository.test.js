/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IConversationRepository } from '../IConversationRepository.js';

class ConcreteConversationRepository extends IConversationRepository {}

describe('IConversationRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new IConversationRepository()).toThrow(
      'IConversationRepository cannot be instantiated'
    );
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(IConversationRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteConversationRepository()).toBeInstanceOf(IConversationRepository);
  });

  it.each([
    ['findById', ['conversation-1']],
    ['findOrCreate', [{ buyerId: 'buyer-1', sellerId: 'seller-1' }]],
    ['findOrCreate', [{ buyerId: 'buyer-1', sellerId: 'seller-1', productId: 'product-1' }]],
    ['listByUser', ['user-1']],
    ['listByUser', ['user-1', { page: 2, limit: 5 }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcreteConversationRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
