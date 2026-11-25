/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IPaymentRepository } from '../IPaymentRepository.js';

class ConcretePaymentRepository extends IPaymentRepository {}

describe('IPaymentRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new IPaymentRepository()).toThrow('IPaymentRepository cannot be instantiated');
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(IPaymentRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcretePaymentRepository()).toBeInstanceOf(IPaymentRepository);
  });

  it.each([
    ['createPending', [{ orderId: 'order-1', amount: 100, currency: 'USD' }]],
    [
      'createPending',
      [{ orderId: 'order-1', amount: 100, currency: 'USD', method: 'card' }, { transaction: {} }],
    ],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new ConcretePaymentRepository();

    await expect(repository[method](...args)).rejects.toThrow('Method not implemented');
  });
});
