import { ConversationDTO } from '../dtos/ConversationDTO.js';

export class ListConversationsUseCase {
  constructor({ conversationRepository }) {
    if (!conversationRepository) throw new Error('conversationRepository is required');
    this.conversationRepository = conversationRepository;
  }

  async execute({ userId, page = 1, limit = 20 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const { items, total } = await this.conversationRepository.listByUser(userId, {
      page: safePage,
      limit: safeLimit,
    });

    return {
      data: items.map((item) => ConversationDTO.fromEntity(item)),
      meta: {
        page: safePage,
        per_page: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }
}
