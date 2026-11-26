export class Notification {
  constructor({
    id,
    profileId,
    type,
    title,
    body = null,
    actionUrl = null,
    payload = {},
    readAt = null,
    createdAt,
  }) {
    this.id = id;
    this.profileId = profileId;
    this.type = type;
    this.title = title;
    this.body = body;
    this.actionUrl = actionUrl;
    this.payload = payload ?? {};
    this.readAt = readAt;
    this.createdAt = createdAt;
  }

  get isRead() {
    return this.readAt !== null && this.readAt !== undefined;
  }
}
