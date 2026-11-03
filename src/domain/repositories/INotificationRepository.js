/**
 * @interface INotificationRepository
 */
export class INotificationRepository {
  constructor() {
    if (this.constructor === INotificationRepository || new.target === INotificationRepository) {
      throw new Error('INotificationRepository cannot be instantiated');
    }
  }

  /** Idempotent on `eventId`: true if inserted, false if the event was already processed. */
  // eslint-disable-next-line no-unused-vars
  async createFromEvent({ eventId, profileId, type, title, body, actionUrl, payload }) {
    throw new Error('Method not implemented: createFromEvent');
  }
}
