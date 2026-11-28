import { NotificationDTO } from '../dtos/NotificationDTO.js';

export class ListNotificationsUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  async execute({ userId, page = 1, limit = 10, unreadOnly = false } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

    const { items, total, unreadCount } = await this.notificationRepository.listByProfile(userId, {
      page: safePage,
      limit: safeLimit,
      unreadOnly: unreadOnly === true,
    });

    return {
      data: items.map((item) => NotificationDTO.fromEntity(item)),
      meta: {
        page: safePage,
        per_page: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
        unread_count: unreadCount,
      },
    };
  }
}
