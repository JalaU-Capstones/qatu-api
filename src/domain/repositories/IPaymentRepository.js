/**
 * @interface IPaymentRepository
 */
export class IPaymentRepository {
  constructor() {
    if (this.constructor === IPaymentRepository || new.target === IPaymentRepository) {
      throw new Error('IPaymentRepository cannot be instantiated');
    }
  }

  /** Creates the order's payment as `pending`; a later endpoint completes it. */
  // eslint-disable-next-line no-unused-vars
  async createPending({ orderId, amount, currency, method = 'simulated' }, { transaction } = {}) {
    throw new Error('Method not implemented: createPending');
  }
}
