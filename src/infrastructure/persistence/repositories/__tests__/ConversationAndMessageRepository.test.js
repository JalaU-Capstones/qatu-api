import { QueryTypes } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../../../domain/entities/Conversation.js';
import { Message } from '../../../../domain/entities/Message.js';
import { ConversationRepository } from '../ConversationRepository.js';
import { MessageRepository } from '../MessageRepository.js';

const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';
const MESSAGE_ID = 'a6eecd55-6c61-4ef4-db2f-2b15bc946a77';
const BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SELLER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';

const conversationRow = {
  id: CONVERSATION_ID,
  buyer_id: BUYER_ID,
  seller_id: SELLER_ID,
  product_id: PRODUCT_ID,
  last_message_at: new Date('2026-11-23T10:00:00.000Z'),
  created_at: new Date('2026-11-23T09:00:00.000Z'),
  updated_at: new Date('2026-11-23T09:30:00.000Z'),
};

const messageRow = {
  id: MESSAGE_ID,
  conversation_id: CONVERSATION_ID,
  sender_id: BUYER_ID,
  content: 'Hola, ¿sigue disponible?',
  read_at: null,
  edited_at: null,
  deleted_at: null,
  created_at: new Date('2026-11-23T10:30:00.000Z'),
};

describe('ConversationRepository', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = { query: vi.fn() };
    repository = new ConversationRepository({ db });
  });

  it('toDomain returns null for a missing row', () => {
    expect(repository.toDomain(null)).toBeNull();
    expect(repository.toDomain(undefined)).toBeNull();
  });

  describe('findOrCreate', () => {
    it('returns created: true when the INSERT returns a row', async () => {
      db.query.mockResolvedValueOnce([conversationRow]);

      const result = await repository.findOrCreate({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.conversations'),
        {
          replacements: {
            buyerId: BUYER_ID,
            sellerId: SELLER_ID,
            productId: PRODUCT_ID,
          },
          type: QueryTypes.SELECT,
        }
      );

      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO NOTHING');
      expect(sql).toContain('RETURNING');

      expect(result.created).toBe(true);
      expect(result.conversation).toBeInstanceOf(Conversation);
      expect(result.conversation).toMatchObject({
        id: CONVERSATION_ID,
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });
    });

    it('falls back to a SELECT and returns created: false on conflict', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([conversationRow]);

      const result = await repository.findOrCreate({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(db.query).toHaveBeenCalledTimes(2);

      const [insertSql, insertOptions] = db.query.mock.calls[0];
      expect(insertSql).toContain('ON CONFLICT');
      expect(insertOptions.replacements).toEqual({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      const [selectSql, selectOptions] = db.query.mock.calls[1];
      expect(selectSql).toContain('FROM public.conversations');
      expect(selectSql).toContain('coalesce(product_id');
      expect(selectOptions).toEqual({
        replacements: {
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          productId: PRODUCT_ID,
        },
        type: QueryTypes.SELECT,
      });

      expect(result.created).toBe(false);
      expect(result.conversation).toBeInstanceOf(Conversation);
      expect(result.conversation.id).toBe(CONVERSATION_ID);
    });

    it('normalizes an omitted productId to null and still returns created: false on conflict', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          ...conversationRow,
          product_id: null,
          last_message_at: null,
        },
      ]);

      const result = await repository.findOrCreate({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
      });

      expect(db.query.mock.calls[0][1].replacements.productId).toBeNull();
      expect(db.query.mock.calls[1][1].replacements.productId).toBeNull();
      expect(result.created).toBe(false);
      expect(result.conversation.productId).toBeNull();
      expect(result.conversation.lastMessageAt).toBeNull();
    });

    it('returns a null conversation if the conflict cannot be resolved', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await repository.findOrCreate({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
      });

      expect(result).toEqual({ conversation: null, created: false });
    });
  });

  describe('findById', () => {
    it('maps the row to a Conversation entity', async () => {
      db.query.mockResolvedValueOnce([conversationRow]);

      const conversation = await repository.findById(CONVERSATION_ID);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = :id'), {
        replacements: { id: CONVERSATION_ID },
        type: QueryTypes.SELECT,
      });
      expect(conversation).toBeInstanceOf(Conversation);
      expect(conversation).toMatchObject({
        id: CONVERSATION_ID,
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
        lastMessageAt: conversationRow.last_message_at,
        createdAt: conversationRow.created_at,
        updatedAt: conversationRow.updated_at,
      });
    });

    it('returns null when no row matches', async () => {
      db.query.mockResolvedValueOnce([]);

      await expect(repository.findById(CONVERSATION_ID)).resolves.toBeNull();
    });
  });

  describe('listByUser', () => {
    it('returns the mapped items and the numeric total', async () => {
      db.query.mockResolvedValueOnce([{ total: '23' }]).mockResolvedValueOnce([conversationRow]);

      const result = await repository.listByUser(BUYER_ID, { page: 3, limit: 10 });

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[0][1]).toEqual({
        replacements: { userId: BUYER_ID },
        type: QueryTypes.SELECT,
      });

      const [rowsSql, rowsOptions] = db.query.mock.calls[1];
      expect(rowsSql).toContain('ORDER BY last_message_at DESC');
      expect(rowsSql).toContain('LIMIT :limit OFFSET :offset');
      expect(rowsOptions.replacements).toEqual({
        userId: BUYER_ID,
        limit: 10,
        offset: 20,
      });

      expect(result.total).toBe(23);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Conversation);
      expect(result.items[0].id).toBe(CONVERSATION_ID);
    });

    it('uses page 1 / limit 20 defaults and a zero total when the count row is absent', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await repository.listByUser(SELLER_ID);

      expect(db.query.mock.calls[1][1].replacements).toEqual({
        userId: SELLER_ID,
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});

describe('MessageRepository', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = { query: vi.fn() };
    repository = new MessageRepository({ db });
  });

  it('toDomain returns null for a missing row', () => {
    expect(repository.toDomain(null)).toBeNull();
    expect(repository.toDomain(undefined)).toBeNull();
  });

  describe('create', () => {
    it('inserts the message and forwards the transaction', async () => {
      const transaction = { id: 'tx-1' };
      db.query.mockResolvedValueOnce([messageRow]);

      const message = await repository.create(
        {
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'Hola, ¿sigue disponible?',
        },
        { transaction }
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.messages'),
        {
          replacements: {
            conversationId: CONVERSATION_ID,
            senderId: BUYER_ID,
            content: 'Hola, ¿sigue disponible?',
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      expect(message).toBeInstanceOf(Message);
      expect(message).toMatchObject({
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: BUYER_ID,
        content: 'Hola, ¿sigue disponible?',
        readAt: null,
        editedAt: null,
        deletedAt: null,
        createdAt: messageRow.created_at,
      });
    });

    it('omits the transaction option when none is supplied', async () => {
      db.query.mockResolvedValueOnce([messageRow]);

      await repository.create({
        conversationId: CONVERSATION_ID,
        senderId: SELLER_ID,
        content: 'Sí, está disponible.',
      });

      expect(db.query.mock.calls[0][1]).not.toHaveProperty('transaction');
      expect(db.query.mock.calls[0][1].replacements).toEqual({
        conversationId: CONVERSATION_ID,
        senderId: SELLER_ID,
        content: 'Sí, está disponible.',
      });
    });

    it('returns null when the insert returns no row', async () => {
      db.query.mockResolvedValueOnce([]);

      await expect(
        repository.create({
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'Hola',
        })
      ).resolves.toBeNull();
    });
  });

  describe('listByConversation', () => {
    it('returns non-deleted messages with pagination metadata', async () => {
      db.query.mockResolvedValueOnce([{ total: '21' }]).mockResolvedValueOnce([messageRow]);

      const result = await repository.listByConversation(CONVERSATION_ID, {
        page: 3,
        limit: 10,
      });

      expect(db.query).toHaveBeenCalledTimes(2);

      const [countSql, countOptions] = db.query.mock.calls[0];
      expect(countSql).toContain('deleted_at IS NULL');
      expect(countOptions).toEqual({
        replacements: { conversationId: CONVERSATION_ID },
        type: QueryTypes.SELECT,
      });

      const [rowsSql, rowsOptions] = db.query.mock.calls[1];
      expect(rowsSql).toContain('deleted_at IS NULL');
      expect(rowsSql).toContain('ORDER BY created_at ASC');
      expect(rowsOptions.replacements).toEqual({
        conversationId: CONVERSATION_ID,
        limit: 10,
        offset: 20,
      });

      expect(result.total).toBe(21);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Message);
      expect(result.items[0].id).toBe(MESSAGE_ID);
    });

    it('uses zero when the count row has no total', async () => {
      db.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([]);

      await expect(repository.listByConversation(CONVERSATION_ID)).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('defaults to page 1 / limit 20 and maps an empty result', async () => {
      db.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      const result = await repository.listByConversation(CONVERSATION_ID);

      expect(db.query.mock.calls[1][1].replacements).toEqual({
        conversationId: CONVERSATION_ID,
        limit: 20,
        offset: 0,
      });
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
