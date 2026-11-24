import { describe, expect, it } from 'vitest';
import { MessageDTO } from '../MessageDTO.js';

describe('MessageDTO', () => {
  it('serializes Date audit fields to ISO strings', () => {
    const dto = MessageDTO.fromEntity({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Hola',
      readAt: new Date('2026-11-23T10:01:00.000Z'),
      editedAt: new Date('2026-11-23T10:02:00.000Z'),
      deletedAt: new Date('2026-11-23T10:03:00.000Z'),
      createdAt: new Date('2026-11-23T10:00:00.000Z'),
    });

    expect(dto).toEqual({
      id: 'm1',
      conversation_id: 'c1',
      sender_id: 'u1',
      content: 'Hola',
      read_at: '2026-11-23T10:01:00.000Z',
      edited_at: '2026-11-23T10:02:00.000Z',
      deleted_at: '2026-11-23T10:03:00.000Z',
      created_at: '2026-11-23T10:00:00.000Z',
    });
  });

  it('keeps pre-formatted strings and explicitly maps missing audit fields to null', () => {
    const dto = MessageDTO.fromEntity({
      id: 'm2',
      conversationId: 'c2',
      senderId: 'u2',
      content: 'Adiós',
      readAt: '2026-11-23T10:01:00.000Z',
      editedAt: null,
      deletedAt: undefined,
      createdAt: '2026-11-23T10:00:00.000Z',
    });

    expect(dto.read_at).toBe('2026-11-23T10:01:00.000Z');
    expect(dto.edited_at).toBeNull();
    expect(dto.deleted_at).toBeNull();
    expect(dto.created_at).toBe('2026-11-23T10:00:00.000Z');
  });
});
