import { ITransactionManager } from '../../application/ports/ITransactionManager.js';
import { sequelize } from '../config/sequelize.js';

/** Managed Sequelize transaction: commits on success, rolls back on error. */
export class SequelizeTransactionManager extends ITransactionManager {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  async run(work) {
    return this.db.transaction((transaction) => work(transaction));
  }
}
