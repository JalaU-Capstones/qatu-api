export class Conversation {
  constructor({ id, buyerId, sellerId, productId = null, lastMessageAt, createdAt, updatedAt }) {
    this.id = id;
    this.buyerId = buyerId;
    this.sellerId = sellerId;
    this.productId = productId;
    this.lastMessageAt = lastMessageAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isParticipant(userId) {
    if (!userId) return false;
    return this.buyerId === userId || this.sellerId === userId;
  }

  getRecipientId(senderId) {
    if (senderId === this.buyerId) return this.sellerId;
    if (senderId === this.sellerId) return this.buyerId;
    return null;
  }
}
