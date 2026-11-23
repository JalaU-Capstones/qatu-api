export class ConversationController {
  constructor({
    createOrGetConversationUseCase,
    listConversationsUseCase,
    listMessagesUseCase,
    sendMessageUseCase,
  }) {
    if (!createOrGetConversationUseCase) {
      throw new Error('createOrGetConversationUseCase is required');
    }
    if (!listConversationsUseCase) {
      throw new Error('listConversationsUseCase is required');
    }
    if (!listMessagesUseCase) {
      throw new Error('listMessagesUseCase is required');
    }
    if (!sendMessageUseCase) {
      throw new Error('sendMessageUseCase is required');
    }

    this.createOrGetConversationUseCase = createOrGetConversationUseCase;
    this.listConversationsUseCase = listConversationsUseCase;
    this.listMessagesUseCase = listMessagesUseCase;
    this.sendMessageUseCase = sendMessageUseCase;
  }

  async createConversation(req, res, next) {
    try {
      const { created, body } = await this.createOrGetConversationUseCase.execute({
        buyerId: req.user.id,
        sellerId: req.body.seller_id,
        productId: req.body.product_id ?? null,
      });
      res.status(created ? 201 : 200).json(body);
    } catch (err) {
      next(err);
    }
  }

  async listConversations(req, res, next) {
    try {
      const result = await this.listConversationsUseCase.execute({
        userId: req.user.id,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listMessages(req, res, next) {
    try {
      const result = await this.listMessagesUseCase.execute({
        conversationId: req.params.conversationId,
        userId: req.user.id,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const result = await this.sendMessageUseCase.execute({
        conversationId: req.params.conversationId,
        senderId: req.user.id,
        content: req.body.content,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}
