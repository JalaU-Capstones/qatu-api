import { MessageDTO } from '../dtos/MessageDTO.js';

function createError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class ListMessagesUseCase {
  constructor({ conversationRepository, messageRepository }) {
    if (!conversationRepository) throw new Error('conversationRepository is required');
    if (!messageRepository) throw new Error('messageRepository is required');

    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({ conversationId, userId, page = 1, limit = 20 }) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }

    if (!conversation.isParticipant(userId)) {
      throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const { items, total } = await this.messageRepository.listByConversation(conversationId, {
      page: safePage,
      limit: safeLimit,
    });

    return {
      data: items.map((item) => MessageDTO.fromEntity(item)),
      meta: {
        page: safePage,
        per_page: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }
}
