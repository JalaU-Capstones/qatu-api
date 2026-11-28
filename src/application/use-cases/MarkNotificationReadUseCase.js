import { NotificationDTO } from '../dtos/NotificationDTO.js';

export class MarkNotificationReadUseCase {
  constructor({ notificationRepository } = {}) {
    if (!notificationRepository) throw new Error('notificationRepository is required');
    this.notificationRepository = notificationRepository;
  }

  /** If it is not theirs, answer 404 so ids cannot be guessed */
  async execute({ notificationId, userId } = {}) {
    const notification = await this.notificationRepository.markAsRead(notificationId, userId);
    if (!notification) {
      const err = new Error('Notification not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      data: NotificationDTO.fromEntity(notification),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
