/**
 * @interface INotificationRepository
 */
export class INotificationRepository {
  constructor() {
    if (this.constructor === INotificationRepository || new.target === INotificationRepository) {
      throw new Error('INotificationRepository cannot be instantiated');
    }
  }

  /** true if inserted, false if that event was already sent to this person */
  // eslint-disable-next-line no-unused-vars
  async createFromEvent({ eventId, profileId, type, title, body, actionUrl, payload }) {
    throw new Error('Method not implemented: createFromEvent');
  }

  /** Newest first, with total and unread counts */
  // eslint-disable-next-line no-unused-vars
  async listByProfile(profileId, { page, limit, unreadOnly }) {
    throw new Error('Method not implemented: listByProfile');
  }

  // eslint-disable-next-line no-unused-vars
  async countUnread(profileId) {
    throw new Error('Method not implemented: countUnread');
  }

  /** null if missing or owned by someone else */
  // eslint-disable-next-line no-unused-vars
  async markAsRead(notificationId, profileId) {
    throw new Error('Method not implemented: markAsRead');
  }

  /** How many went from unread to read */
  // eslint-disable-next-line no-unused-vars
  async markAllAsRead(profileId) {
    throw new Error('Method not implemented: markAllAsRead');
  }
}
