import { describe, expect, it } from 'vitest';
import { ConversationDTO } from '../ConversationDTO.js';

describe('ConversationDTO', () => {
  it('serializes Date timestamps and a populated product_id', () => {
    const dto = ConversationDTO.fromEntity({
      id: 'c1',
      buyerId: 'b1',
      sellerId: 's1',
      productId: 'p1',
      lastMessageAt: new Date('2026-11-23T10:00:00.000Z'),
      createdAt: new Date('2026-11-20T10:00:00.000Z'),
      updatedAt: new Date('2026-11-21T10:00:00.000Z'),
    });

    expect(dto).toEqual({
      id: 'c1',
      buyer_id: 'b1',
      seller_id: 's1',
      product_id: 'p1',
      last_message_at: '2026-11-23T10:00:00.000Z',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-21T10:00:00.000Z',
    });
  });

  it('keeps pre-formatted timestamps and maps a missing product_id to null', () => {
    const dto = ConversationDTO.fromEntity({
      id: 'c2',
      buyerId: 'b2',
      sellerId: 's2',
      lastMessageAt: '2026-11-23T10:00:00.000Z',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: null,
    });

    expect(dto.product_id).toBeNull();
    expect(dto.last_message_at).toBe('2026-11-23T10:00:00.000Z');
    expect(dto.created_at).toBe('2026-11-20T10:00:00.000Z');
    expect(dto.updated_at).toBeNull();
  });
});
