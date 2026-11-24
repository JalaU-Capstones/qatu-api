import { describe, expect, it } from 'vitest';
import { ITransactionManager } from '../ITransactionManager.js';

class ConcreteTransactionManager extends ITransactionManager {}

describe('ITransactionManager interface', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new ITransactionManager()).toThrow('ITransactionManager cannot be instantiated');
  });

  it('allows subclasses to be instantiated', () => {
    expect(new ConcreteTransactionManager()).toBeInstanceOf(ITransactionManager);
  });

  it('rejects unimplemented run on a subclass', async () => {
    const manager = new ConcreteTransactionManager();

    await expect(manager.run(async () => 'value')).rejects.toThrow('Method not implemented: run');
  });
});
