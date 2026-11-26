const toIso = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));

export class NotificationDTO {
  static fromEntity(notification) {
    return {
      id: notification.id,
      profile_id: notification.profileId,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      action_url: notification.actionUrl ?? null,
      payload: notification.payload ?? {},
      read_at: toIso(notification.readAt),
      created_at: toIso(notification.createdAt),
    };
  }
}
