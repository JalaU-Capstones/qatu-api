export class MessageDTO {
  static fromEntity(message) {
    return {
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      content: message.content,
      read_at:
        message.readAt instanceof Date ? message.readAt.toISOString() : (message.readAt ?? null),
      edited_at:
        message.editedAt instanceof Date
          ? message.editedAt.toISOString()
          : (message.editedAt ?? null),
      deleted_at:
        message.deletedAt instanceof Date
          ? message.deletedAt.toISOString()
          : (message.deletedAt ?? null),
      created_at:
        message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    };
  }
}
