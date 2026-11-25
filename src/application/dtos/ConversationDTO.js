export class ConversationDTO {
  static fromEntity(conversation) {
    return {
      id: conversation.id,
      buyer_id: conversation.buyerId,
      seller_id: conversation.sellerId,
      product_id: conversation.productId ?? null,
      last_message_at:
        conversation.lastMessageAt instanceof Date
          ? conversation.lastMessageAt.toISOString()
          : conversation.lastMessageAt,
      created_at:
        conversation.createdAt instanceof Date
          ? conversation.createdAt.toISOString()
          : conversation.createdAt,
      updated_at:
        conversation.updatedAt instanceof Date
          ? conversation.updatedAt.toISOString()
          : conversation.updatedAt,
    };
  }
}
