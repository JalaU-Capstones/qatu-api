export class MarkAllNotificationsReadUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  async execute({ userId } = {}) {
    const updatedCount = await this.notificationRepository.markAllAsRead(userId);
    return {
      data: { updated_count: updatedCount },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
