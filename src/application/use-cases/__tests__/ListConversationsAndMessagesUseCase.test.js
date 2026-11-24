import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../../domain/entities/Conversation.js';
import { Message } from '../../../domain/entities/Message.js';
import { ListConversationsUseCase } from '../ListConversationsUseCase.js';
import { ListMessagesUseCase } from '../ListMessagesUseCase.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';

function makeConversation(id = CONVERSATION_ID) {
  return new Conversation({
    id,
    buyerId: USER_ID,
    sellerId: OTHER_USER_ID,
    productId: PRODUCT_ID,
    lastMessageAt: new Date('2026-11-23T10:00:00.000Z'),
    createdAt: new Date('2026-11-23T09:00:00.000Z'),
    updatedAt: new Date('2026-11-23T09:00:00.000Z'),
  });
}

function makeMessage(id) {
  return new Message({
    id,
    conversationId: CONVERSATION_ID,
    senderId: OTHER_USER_ID,
    content: 'Mensaje de prueba',
    readAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-11-23T10:05:00.000Z'),
  });
}

describe('ListConversationsUseCase', () => {
  let conversationRepository;
  let useCase;

  beforeEach(() => {
    conversationRepository = {
      listByUser: vi.fn(),
    };
    useCase = new ListConversationsUseCase({ conversationRepository });
  });

  it('requires a conversation repository', () => {
    expect(() => new ListConversationsUseCase({})).toThrow('conversationRepository is required');
  });

  it('returns the paginated conversations mapped to DTOs', async () => {
    conversationRepository.listByUser.mockResolvedValue({
      items: [makeConversation()],
      total: 1,
    });

    const result = await useCase.execute({ userId: USER_ID, page: 1, limit: 20 });

    expect(conversationRepository.listByUser).toHaveBeenCalledWith(USER_ID, {
      page: 1,
      limit: 20,
    });
    expect(result.data).toEqual([
      {
        id: CONVERSATION_ID,
        buyer_id: USER_ID,
        seller_id: OTHER_USER_ID,
        product_id: PRODUCT_ID,
        last_message_at: '2026-11-23T10:00:00.000Z',
        created_at: '2026-11-23T09:00:00.000Z',
        updated_at: '2026-11-23T09:00:00.000Z',
      },
    ]);
    expect(result.meta).toEqual({
      page: 1,
      per_page: 20,
      total: 1,
      total_pages: 1,
    });
  });

  it('computes total_pages by rounding up the total over the page size', async () => {
    conversationRepository.listByUser.mockResolvedValue({
      items: [],
      total: 25,
    });

    const result = await useCase.execute({ userId: USER_ID, page: 2, limit: 10 });

    expect(conversationRepository.listByUser).toHaveBeenCalledWith(USER_ID, {
      page: 2,
      limit: 10,
    });
    expect(result.meta).toEqual({
      page: 2,
      per_page: 10,
      total: 25,
      total_pages: 3,
    });
  });

  it('never reports total_pages below 1 for an empty result set', async () => {
    conversationRepository.listByUser.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.meta).toEqual({
      page: 1,
      per_page: 20,
      total: 0,
      total_pages: 1,
    });
  });

  it('clamps the page to at least 1 and the limit to the 1..100 range', async () => {
    conversationRepository.listByUser.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ userId: USER_ID, page: 0, limit: 500 });
    expect(conversationRepository.listByUser).toHaveBeenLastCalledWith(USER_ID, {
      page: 1,
      limit: 100,
    });

    await useCase.execute({ userId: USER_ID, page: 'not-a-number', limit: -5 });
    expect(conversationRepository.listByUser).toHaveBeenLastCalledWith(USER_ID, {
      page: 1,
      limit: 1,
    });

    await useCase.execute({ userId: USER_ID, page: 3, limit: 0 });
    expect(conversationRepository.listByUser).toHaveBeenLastCalledWith(USER_ID, {
      page: 3,
      limit: 20,
    });
  });

  it('passes the raw user id through to the repository for filtering', async () => {
    conversationRepository.listByUser.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ userId: OTHER_USER_ID });

    expect(conversationRepository.listByUser).toHaveBeenCalledWith(OTHER_USER_ID, {
      page: 1,
      limit: 20,
    });
  });
});

describe('ListMessagesUseCase', () => {
  let conversationRepository;
  let messageRepository;
  let useCase;

  beforeEach(() => {
    conversationRepository = {
      findById: vi.fn().mockResolvedValue(makeConversation()),
    };
    messageRepository = {
      listByConversation: vi.fn(),
    };
    useCase = new ListMessagesUseCase({ conversationRepository, messageRepository });
  });

  describe('constructor', () => {
    it('requires a conversation repository', () => {
      expect(() => new ListMessagesUseCase({ messageRepository })).toThrow(
        'conversationRepository is required'
      );
    });

    it('requires a message repository', () => {
      expect(() => new ListMessagesUseCase({ conversationRepository })).toThrow(
        'messageRepository is required'
      );
    });
  });

  it('returns the paginated messages mapped to DTOs', async () => {
    messageRepository.listByConversation.mockResolvedValue({
      items: [makeMessage('a6eecd55-6c61-4ef4-db2f-2b15bc946a77')],
      total: 21,
    });

    const result = await useCase.execute({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      page: 3,
      limit: 10,
    });

    expect(conversationRepository.findById).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(messageRepository.listByConversation).toHaveBeenCalledWith(CONVERSATION_ID, {
      page: 3,
      limit: 10,
    });
    expect(result.data).toEqual([
      {
        id: 'a6eecd55-6c61-4ef4-db2f-2b15bc946a77',
        conversation_id: CONVERSATION_ID,
        sender_id: OTHER_USER_ID,
        content: 'Mensaje de prueba',
        read_at: null,
        edited_at: null,
        deleted_at: null,
        created_at: '2026-11-23T10:05:00.000Z',
      },
    ]);
    expect(result.meta).toEqual({
      page: 3,
      per_page: 10,
      total: 21,
      total_pages: 3,
    });
  });

  it('allows the seller to read their own conversations', async () => {
    messageRepository.listByConversation.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ conversationId: CONVERSATION_ID, userId: OTHER_USER_ID });

    expect(messageRepository.listByConversation).toHaveBeenCalledTimes(1);
  });

  it('clamps pagination to the supported range', async () => {
    messageRepository.listByConversation.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      page: -2,
      limit: 1000,
    });

    expect(messageRepository.listByConversation).toHaveBeenCalledWith(CONVERSATION_ID, {
      page: 1,
      limit: 100,
    });
    expect(result.meta).toEqual({
      page: 1,
      per_page: 100,
      total: 0,
      total_pages: 1,
    });
  });

  it('falls back to default pagination for non-numeric values', async () => {
    messageRepository.listByConversation.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      page: 'abc',
      limit: null,
    });

    expect(messageRepository.listByConversation).toHaveBeenCalledWith(CONVERSATION_ID, {
      page: 1,
      limit: 20,
    });
    expect(result.meta.page).toBe(1);
    expect(result.meta.per_page).toBe(20);
  });

  it('returns 404 NOT_FOUND when the conversation does not exist', async () => {
    conversationRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ conversationId: CONVERSATION_ID, userId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(messageRepository.listByConversation).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN for users outside the conversation', async () => {
    await expect(
      useCase.execute({ conversationId: CONVERSATION_ID, userId: 'outsider-id' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(messageRepository.listByConversation).not.toHaveBeenCalled();
  });
});
