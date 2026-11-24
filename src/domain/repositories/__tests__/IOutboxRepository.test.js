/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IOutboxRepository } from '../IOutboxRepository.js';

class ConcreteOutboxRepository extends IOutboxRepository {}

describe('IOutboxRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new IOutboxRepository()).toThrow('IOutboxRepository cannot be instantiated');
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(IOutboxRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteOutboxRepository()).toBeInstanceOf(IOutboxRepository);
  });

  it.each([
    ['enqueue', [{ eventType: 'OrderPlaced' }]],
    ['enqueue', [{ eventType: 'OrderPlaced' }, { transaction: {} }]],
    ['claimPendingBatch', [10]],
    ['claimPendingBatch', [10, { transaction: {} }]],
    ['markPublished', ['event-1']],
    ['markPublished', ['event-1', { transaction: {} }]],
    ['scheduleRetry', [{ id: 'event-1', error: 'boom', maxAttempts: 5 }]],
    ['scheduleRetry', [{ id: 'event-1', error: 'boom', maxAttempts: 5 }, { transaction: {} }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcreteOutboxRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
