export class IConversationRepository {
  constructor() {
    if (this.constructor === IConversationRepository || new.target === IConversationRepository) {
      throw new Error('IConversationRepository cannot be instantiated');
    }
  }

  // eslint-disable-next-line no-unused-vars
  async findById(id) {
    throw new Error('Method not implemented: findById');
  }

  // eslint-disable-next-line no-unused-vars
  async findOrCreate({ buyerId, sellerId, productId = null }) {
    throw new Error('Method not implemented: findOrCreate');
  }

  // eslint-disable-next-line no-unused-vars
  async listByUser(userId, { page = 1, limit = 20 } = {}) {
    throw new Error('Method not implemented: listByUser');
  }
}
