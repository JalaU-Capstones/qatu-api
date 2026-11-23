export class IMessageRepository {
  constructor() {
    if (this.constructor === IMessageRepository || new.target === IMessageRepository) {
      throw new Error('IMessageRepository cannot be instantiated');
    }
  }

  // eslint-disable-next-line no-unused-vars
  async create({ conversationId, senderId, content }, { transaction } = {}) {
    throw new Error('Method not implemented: create');
  }

  // eslint-disable-next-line no-unused-vars
  async listByConversation(conversationId, { page = 1, limit = 20 } = {}) {
    throw new Error('Method not implemented: listByConversation');
  }
}
