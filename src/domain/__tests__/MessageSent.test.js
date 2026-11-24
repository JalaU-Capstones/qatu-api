import { describe, expect, it } from 'vitest';
import { Conversation } from '../entities/Conversation.js';
import { Message } from '../entities/Message.js';
import {
  MESSAGE_SENT_EVENT_TYPE,
  MESSAGE_SENT_ROUTING_KEY,
  buildMessageSentEvent,
} from '../events/MessageSent.js';

describe('MessageSent domain event', () => {
  const conversation = new Conversation({
    id: 'conversation-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    productId: 'product-1',
  });
  const message = new Message({
    id: 'message-1',
    conversationId: conversation.id,
    senderId: 'buyer-1',
    content: 'Is this still available?',
  });

  it('exposes the event type and routing key constants', () => {
    expect(MESSAGE_SENT_EVENT_TYPE).toBe('MessageSent');
    expect(MESSAGE_SENT_ROUTING_KEY).toBe('message.sent');
  });

  it('builds the event payload for a product conversation', () => {
    expect(buildMessageSentEvent({ message, conversation, recipientId: 'seller-1' })).toEqual({
      eventType: 'MessageSent',
      aggregateType: 'conversation',
      aggregateId: 'conversation-1',
      routingKey: 'message.sent',
      payload: {
        message_id: 'message-1',
        conversation_id: 'conversation-1',
        sender_id: 'buyer-1',
        recipient_id: 'seller-1',
        product_id: 'product-1',
      },
    });
  });

  it('normalizes a missing product id to null', () => {
    const genericConversation = new Conversation({
      id: 'conversation-2',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(
      buildMessageSentEvent({
        message,
        conversation: genericConversation,
        recipientId: 'buyer-1',
      }).payload.product_id
    ).toBeNull();
  });
});
