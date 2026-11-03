import { describe, expect, it, vi } from 'vitest';
import { ITransactionManager } from '../../../application/ports/ITransactionManager.js';
import { SequelizeTransactionManager } from '../SequelizeTransactionManager.js';

describe('SequelizeTransactionManager', () => {
  it('implements the transaction port', () => {
    const manager = new SequelizeTransactionManager({ db: { transaction: vi.fn() } });

    expect(manager).toBeInstanceOf(ITransactionManager);
    expect(() => new ITransactionManager()).toThrow('cannot be instantiated');
  });

  it('hands the Sequelize transaction to the unit of work and returns its result', async () => {
    const transaction = { id: 'tx-1' };
    const db = { transaction: vi.fn(async (callback) => callback(transaction)) };
    const manager = new SequelizeTransactionManager({ db });
    const work = vi.fn().mockResolvedValue('done');

    await expect(manager.run(work)).resolves.toBe('done');
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(transaction);
  });

  it('propagates the failure so Sequelize rolls the transaction back', async () => {
    const db = { transaction: vi.fn(async (callback) => callback({})) };
    const manager = new SequelizeTransactionManager({ db });
    const failure = new Error('constraint violated');

    await expect(manager.run(async () => Promise.reject(failure))).rejects.toBe(failure);
  });

  it('the abstract port cannot run work', async () => {
    class Incomplete extends ITransactionManager {}

    await expect(new Incomplete().run(async () => 1)).rejects.toThrow('Method not implemented');
  });
});
