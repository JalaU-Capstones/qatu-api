export class Message {
  constructor({
    id,
    conversationId,
    senderId,
    content,
    readAt = null,
    editedAt = null,
    deletedAt = null,
    createdAt,
  }) {
    this.id = id;
    this.conversationId = conversationId;
    this.senderId = senderId;
    this.content = content;
    this.readAt = readAt;
    this.editedAt = editedAt;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt;
  }
}
