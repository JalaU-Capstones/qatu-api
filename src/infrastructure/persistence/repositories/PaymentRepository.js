import { QueryTypes } from 'sequelize';
import { IPaymentRepository } from '../../../domain/repositories/IPaymentRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class PaymentRepository extends IPaymentRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  async createPending({ orderId, amount, currency, method = 'simulated' }, { transaction } = {}) {
    const rows = await this.db.query(
      `INSERT INTO public.payments (order_id, amount, currency, method, status)
       VALUES (:orderId, :amount, :currency, :method, 'pending')
       RETURNING id, order_id, amount, currency, method, status`,
      {
        replacements: { orderId, amount, currency, method },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );

    if (!rows || rows.length === 0) {
      throw new Error('Failed to create payment: no row returned');
    }

    return { ...rows[0], amount: Number(rows[0].amount) };
  }
}
