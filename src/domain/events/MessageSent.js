export const MESSAGE_SENT_EVENT_TYPE = 'MessageSent';
export const MESSAGE_SENT_ROUTING_KEY = 'message.sent';

export function buildMessageSentEvent({ message, conversation, recipientId }) {
  return {
    eventType: MESSAGE_SENT_EVENT_TYPE,
    aggregateType: 'conversation',
    aggregateId: conversation.id,
    routingKey: MESSAGE_SENT_ROUTING_KEY,
    payload: {
      message_id: message.id,
      conversation_id: conversation.id,
      sender_id: message.senderId,
      recipient_id: recipientId,
      product_id: conversation.productId ?? null,
    },
  };
}
