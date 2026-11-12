/** @interface IOutboxRepository: persistence port of the transactional outbox (ADR-014). */
export class IOutboxRepository {
  constructor() {
    if (this.constructor === IOutboxRepository || new.target === IOutboxRepository) {
      throw new Error('IOutboxRepository cannot be instantiated');
    }
  }

  /** Stores a `pending` event; pass the `transaction` of the state change so both commit together. */
  // eslint-disable-next-line no-unused-vars
  async enqueue(event, { transaction } = {}) {
    throw new Error('Method not implemented: enqueue');
  }

  /** Locks up to `limit` due events (FOR UPDATE SKIP LOCKED) until the transaction ends. */
  // eslint-disable-next-line no-unused-vars
  async claimPendingBatch(limit, { transaction } = {}) {
    throw new Error('Method not implemented: claimPendingBatch');
  }

  // eslint-disable-next-line no-unused-vars
  async markPublished(id, { transaction } = {}) {
    throw new Error('Method not implemented: markPublished');
  }

  /** Bumps `attempts` and backs off; marks the event `failed` once `maxAttempts` is reached. */
  // eslint-disable-next-line no-unused-vars
  async scheduleRetry({ id, error, maxAttempts }, { transaction } = {}) {
    throw new Error('Method not implemented: scheduleRetry');
  }
}
