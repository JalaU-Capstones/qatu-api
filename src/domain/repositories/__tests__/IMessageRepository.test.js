/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IMessageRepository } from '../IMessageRepository.js';

class ConcreteMessageRepository extends IMessageRepository {}

describe('IMessageRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new IMessageRepository()).toThrow('IMessageRepository cannot be instantiated');
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(IMessageRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteMessageRepository()).toBeInstanceOf(IMessageRepository);
  });

  it.each([
    ['create', [{ conversationId: 'conversation-1', senderId: 'buyer-1', content: 'Hi' }]],
    [
      'create',
      [
        { conversationId: 'conversation-1', senderId: 'buyer-1', content: 'Hi' },
        { transaction: {} },
      ],
    ],
    ['listByConversation', ['conversation-1']],
    ['listByConversation', ['conversation-1', { page: 2, limit: 5 }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcreteMessageRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
