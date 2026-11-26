export class NotificationController {
  constructor({
    listNotificationsUseCase,
    getUnreadNotificationsCountUseCase,
    markNotificationReadUseCase,
    markAllNotificationsReadUseCase,
  } = {}) {
    if (!listNotificationsUseCase) throw new Error('listNotificationsUseCase is required');
    if (!getUnreadNotificationsCountUseCase) {
      throw new Error('getUnreadNotificationsCountUseCase is required');
    }
    if (!markNotificationReadUseCase) throw new Error('markNotificationReadUseCase is required');
    if (!markAllNotificationsReadUseCase) {
      throw new Error('markAllNotificationsReadUseCase is required');
    }

    this.listNotificationsUseCase = listNotificationsUseCase;
    this.getUnreadNotificationsCountUseCase = getUnreadNotificationsCountUseCase;
    this.markNotificationReadUseCase = markNotificationReadUseCase;
    this.markAllNotificationsReadUseCase = markAllNotificationsReadUseCase;
  }

  async listNotifications(req, res, next) {
    try {
      const query = req.validatedQuery ?? {};
      const result = await this.listNotificationsUseCase.execute({
        userId: req.user.id,
        page: query.page,
        limit: query.limit,
        unreadOnly: query.unread_only,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await this.getUnreadNotificationsCountUseCase.execute({ userId: req.user.id });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await this.markNotificationReadUseCase.execute({
        notificationId: req.params.notificationId,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await this.markAllNotificationsReadUseCase.execute({ userId: req.user.id });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
