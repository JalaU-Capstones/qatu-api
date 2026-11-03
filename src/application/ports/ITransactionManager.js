/** @interface ITransactionManager: runs work atomically (commit on success, rollback on error). */
export class ITransactionManager {
  constructor() {
    if (this.constructor === ITransactionManager || new.target === ITransactionManager) {
      throw new Error('ITransactionManager cannot be instantiated');
    }
  }

  /** The `transaction` handle is opaque; repositories join it via `{ transaction }`. */
  // eslint-disable-next-line no-unused-vars
  async run(work) {
    throw new Error('Method not implemented: run');
  }
}
