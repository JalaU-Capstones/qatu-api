import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../../domain/entities/Conversation.js';
import { Message } from '../../../domain/entities/Message.js';
import { SendMessageUseCase } from '../SendMessageUseCase.js';

const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';
const BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SELLER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const OUTSIDER_ID = 'f5ddbb44-5b50-4de3-ca1e-1a04ab835f66';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';
const MESSAGE_ID = 'a6eecd55-6c61-4ef4-db2f-2b15bc946a77';
const EVENT_ID = 'b7ffde66-7d72-4f05-ec30-3c26cd057b88';

const TRANSACTION = Object.freeze({ id: 'tx-1' });

function makeConversation(overrides = {}) {
  return new Conversation({
    id: CONVERSATION_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    productId: PRODUCT_ID,
    lastMessageAt: null,
    createdAt: new Date('2026-11-23T09:00:00.000Z'),
    updatedAt: new Date('2026-11-23T09:00:00.000Z'),
    ...overrides,
  });
}

function makeMessage(overrides = {}) {
  return new Message({
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    senderId: BUYER_ID,
    content: 'Hola, ¿sigue disponible?',
    readAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-11-23T10:30:00.000Z'),
    ...overrides,
  });
}

describe('SendMessageUseCase', () => {
  let conversationRepository;
  let messageRepository;
  let outboxRepository;
  let transactionManager;
  let useCase;

  beforeEach(() => {
    conversationRepository = {
      findById: vi.fn().mockResolvedValue(makeConversation()),
    };
    messageRepository = {
      create: vi.fn().mockResolvedValue(makeMessage()),
    };
    outboxRepository = {
      enqueue: vi.fn().mockResolvedValue(EVENT_ID),
    };
    transactionManager = {
      run: vi.fn().mockImplementation(async (callback) => callback(TRANSACTION)),
    };

    useCase = new SendMessageUseCase({
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    });
  });

  describe('constructor', () => {
    const dependencies = () => ({
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    });

    it('requires a conversation repository', () => {
      expect(
        () => new SendMessageUseCase({ ...dependencies(), conversationRepository: undefined })
      ).toThrow('conversationRepository is required');
    });

    it('requires a message repository', () => {
      expect(
        () => new SendMessageUseCase({ ...dependencies(), messageRepository: undefined })
      ).toThrow('messageRepository is required');
    });

    it('requires an outbox repository', () => {
      expect(
        () => new SendMessageUseCase({ ...dependencies(), outboxRepository: undefined })
      ).toThrow('outboxRepository is required');
    });

    it('requires a transaction manager', () => {
      expect(
        () => new SendMessageUseCase({ ...dependencies(), transactionManager: undefined })
      ).toThrow('transactionManager is required');
    });
  });

  describe('successful delivery', () => {
    it('persists the message and enqueues the MessageSent event in the same transaction', async () => {
      const result = await useCase.execute({
        conversationId: CONVERSATION_ID,
        senderId: BUYER_ID,
        content: '  Hola, ¿sigue disponible?  ',
      });

      expect(transactionManager.run).toHaveBeenCalledTimes(1);

      expect(messageRepository.create).toHaveBeenCalledWith(
        {
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'Hola, ¿sigue disponible?',
        },
        { transaction: TRANSACTION }
      );

      expect(outboxRepository.enqueue).toHaveBeenCalledWith(
        {
          eventType: 'MessageSent',
          aggregateType: 'conversation',
          aggregateId: CONVERSATION_ID,
          routingKey: 'message.sent',
          payload: {
            message_id: MESSAGE_ID,
            conversation_id: CONVERSATION_ID,
            sender_id: BUYER_ID,
            recipient_id: SELLER_ID,
            product_id: PRODUCT_ID,
          },
        },
        { transaction: TRANSACTION }
      );

      const createTransaction = messageRepository.create.mock.calls[0][1].transaction;
      const enqueueTransaction = outboxRepository.enqueue.mock.calls[0][1].transaction;
      expect(createTransaction).toBe(TRANSACTION);
      expect(enqueueTransaction).toBe(TRANSACTION);
      expect(createTransaction).toBe(enqueueTransaction);

      expect(result.data).toEqual({
        id: MESSAGE_ID,
        conversation_id: CONVERSATION_ID,
        sender_id: BUYER_ID,
        content: 'Hola, ¿sigue disponible?',
        read_at: null,
        edited_at: null,
        deleted_at: null,
        created_at: '2026-11-23T10:30:00.000Z',
      });
      expect(new Date(result.meta.timestamp).toISOString()).toBe(result.meta.timestamp);
    });

    it('addresses the event to the buyer when the seller replies', async () => {
      messageRepository.create.mockResolvedValue(
        makeMessage({ senderId: SELLER_ID, content: 'Sí, está disponible.' })
      );

      await useCase.execute({
        conversationId: CONVERSATION_ID,
        senderId: SELLER_ID,
        content: 'Sí, está disponible.',
      });

      expect(outboxRepository.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            sender_id: SELLER_ID,
            recipient_id: BUYER_ID,
          }),
        }),
        { transaction: TRANSACTION }
      );
    });

    it('sends product_id as null when the conversation is not tied to a product', async () => {
      conversationRepository.findById.mockResolvedValue(makeConversation({ productId: null }));

      await useCase.execute({
        conversationId: CONVERSATION_ID,
        senderId: BUYER_ID,
        content: 'Consulta general',
      });

      expect(outboxRepository.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ product_id: null }),
        }),
        { transaction: TRANSACTION }
      );
    });
  });

  describe('content validation', () => {
    it.each([
      ['empty', ''],
      ['whitespace-only', '   \n\t  '],
      ['not a string', null],
      ['undefined', undefined],
    ])(
      'rejects %s content with 422 VALIDATION_ERROR without opening a transaction',
      async (_label, content) => {
        await expect(
          useCase.execute({ conversationId: CONVERSATION_ID, senderId: BUYER_ID, content })
        ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

        expect(conversationRepository.findById).not.toHaveBeenCalled();
        expect(transactionManager.run).not.toHaveBeenCalled();
        expect(messageRepository.create).not.toHaveBeenCalled();
        expect(outboxRepository.enqueue).not.toHaveBeenCalled();
      }
    );

    it('rejects content longer than 2000 characters', async () => {
      await expect(
        useCase.execute({
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'a'.repeat(2001),
        })
      ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('accepts content at the 2000-character boundary', async () => {
      const content = 'a'.repeat(2000);

      await useCase.execute({ conversationId: CONVERSATION_ID, senderId: BUYER_ID, content });

      expect(messageRepository.create).toHaveBeenCalledWith(expect.objectContaining({ content }), {
        transaction: TRANSACTION,
      });
    });
  });

  describe('conversation access', () => {
    it('returns 404 NOT_FOUND when the conversation does not exist', async () => {
      conversationRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'Hola',
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

      expect(transactionManager.run).not.toHaveBeenCalled();
      expect(messageRepository.create).not.toHaveBeenCalled();
    });

    it('returns 403 FORBIDDEN when the sender is not a participant', async () => {
      await expect(
        useCase.execute({
          conversationId: CONVERSATION_ID,
          senderId: OUTSIDER_ID,
          content: 'Hola',
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

      expect(transactionManager.run).not.toHaveBeenCalled();
      expect(messageRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('transaction integrity', () => {
    it('does not enqueue the event if persisting the message fails', async () => {
      messageRepository.create.mockRejectedValue(new Error('insert failed'));

      await expect(
        useCase.execute({
          conversationId: CONVERSATION_ID,
          senderId: BUYER_ID,
          content: 'Hola',
        })
      ).rejects.toThrow('insert failed');

      expect(transactionManager.run).toHaveBeenCalledTimes(1);
      expect(outboxRepository.enqueue).not.toHaveBeenCalled();
    });
  });
});
