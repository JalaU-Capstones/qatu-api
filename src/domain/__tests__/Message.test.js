import { describe, expect, it } from 'vitest';
import { Message } from '../entities/Message.js';

describe('Message Domain Entity', () => {
  it('assigns all fields and defaults audit timestamps to null', () => {
    const createdAt = new Date('2026-10-10T12:00:00.000Z');
    const message = new Message({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      content: 'Hello!',
      createdAt,
    });

    expect(message.id).toBe('message-1');
    expect(message.conversationId).toBe('conversation-1');
    expect(message.senderId).toBe('buyer-1');
    expect(message.content).toBe('Hello!');
    expect(message.readAt).toBeNull();
    expect(message.editedAt).toBeNull();
    expect(message.deletedAt).toBeNull();
    expect(message.createdAt).toBe(createdAt);
  });

  it('keeps explicit read, edited and deleted timestamps', () => {
    const readAt = new Date('2026-10-10T13:00:00.000Z');
    const editedAt = new Date('2026-10-10T14:00:00.000Z');
    const deletedAt = new Date('2026-10-10T15:00:00.000Z');
    const message = new Message({
      id: 'message-2',
      conversationId: 'conversation-2',
      senderId: 'seller-1',
      content: 'Edited answer',
      readAt,
      editedAt,
      deletedAt,
    });

    expect(message.readAt).toBe(readAt);
    expect(message.editedAt).toBe(editedAt);
    expect(message.deletedAt).toBe(deletedAt);
    expect(message.createdAt).toBeUndefined();
  });
});
