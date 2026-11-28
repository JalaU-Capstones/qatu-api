export class GetUnreadNotificationsCountUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  async execute({ userId } = {}) {
    const unreadCount = await this.notificationRepository.countUnread(userId);
    return {
      data: { unread_count: unreadCount },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
