import { describe, expect, it } from 'vitest';
import { Conversation } from '../entities/Conversation.js';

describe('Conversation Domain Entity', () => {
  const build = (overrides = {}) =>
    new Conversation({
      id: 'conversation-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      productId: 'product-1',
      lastMessageAt: new Date('2026-10-10T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-10T00:00:00.000Z'),
      ...overrides,
    });

  it('assigns every constructor field', () => {
    const conversation = build();

    expect(conversation.id).toBe('conversation-1');
    expect(conversation.buyerId).toBe('buyer-1');
    expect(conversation.sellerId).toBe('seller-1');
    expect(conversation.productId).toBe('product-1');
    expect(conversation.lastMessageAt).toEqual(new Date('2026-10-10T00:00:00.000Z'));
    expect(conversation.createdAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(conversation.updatedAt).toEqual(new Date('2026-10-10T00:00:00.000Z'));
  });

  it('defaults productId to null when omitted', () => {
    const conversation = new Conversation({
      id: 'conversation-2',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(conversation.productId).toBeNull();
  });

  it('isParticipant accepts the buyer and the seller only', () => {
    const conversation = build();

    expect(conversation.isParticipant('buyer-1')).toBe(true);
    expect(conversation.isParticipant('seller-1')).toBe(true);
    expect(conversation.isParticipant('outsider')).toBe(false);
    expect(conversation.isParticipant('')).toBe(false);
    expect(conversation.isParticipant(null)).toBe(false);
    expect(conversation.isParticipant(undefined)).toBe(false);
  });

  it('getRecipientId returns the other participant, or null for outsiders', () => {
    const conversation = build();

    expect(conversation.getRecipientId('buyer-1')).toBe('seller-1');
    expect(conversation.getRecipientId('seller-1')).toBe('buyer-1');
    expect(conversation.getRecipientId('outsider')).toBeNull();
    expect(conversation.getRecipientId(null)).toBeNull();
  });
});
