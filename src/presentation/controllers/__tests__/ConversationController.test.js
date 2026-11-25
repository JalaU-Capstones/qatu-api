import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../ConversationController.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const CONVERSATION_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('ConversationController', () => {
  let useCases;
  let controller;

  beforeEach(() => {
    useCases = {
      createOrGetConversationUseCase: { execute: vi.fn() },
      listConversationsUseCase: { execute: vi.fn() },
      listMessagesUseCase: { execute: vi.fn() },
      sendMessageUseCase: { execute: vi.fn() },
    };
    controller = new ConversationController(useCases);
  });

  it('requires all four use cases in the constructor', () => {
    expect(() => new ConversationController({})).toThrow(
      'createOrGetConversationUseCase is required'
    );
    expect(
      () =>
        new ConversationController({
          createOrGetConversationUseCase: useCases.createOrGetConversationUseCase,
        })
    ).toThrow('listConversationsUseCase is required');
    expect(
      () =>
        new ConversationController({
          ...useCases,
          listMessagesUseCase: null,
        })
    ).toThrow('listMessagesUseCase is required');
    expect(
      () =>
        new ConversationController({
          ...useCases,
          sendMessageUseCase: null,
        })
    ).toThrow('sendMessageUseCase is required');
  });

  describe('createConversation', () => {
    it('responds with 201 for a created conversation and 200 for an existing one', async () => {
      const res = createResponse();
      useCases.createOrGetConversationUseCase.execute.mockResolvedValueOnce({
        created: true,
        body: { id: CONVERSATION_ID },
      });
      useCases.createOrGetConversationUseCase.execute.mockResolvedValueOnce({
        created: false,
        body: { id: CONVERSATION_ID },
      });

      const req = {
        user: { id: USER_ID },
        body: { seller_id: 'seller-1' },
      };
      await controller.createConversation(req, res, vi.fn());
      await controller.createConversation(
        { ...req, body: { seller_id: 'seller-1', product_id: 'p-1' } },
        res,
        vi.fn()
      );

      expect(useCases.createOrGetConversationUseCase.execute).toHaveBeenNthCalledWith(1, {
        buyerId: USER_ID,
        sellerId: 'seller-1',
        productId: null,
      });
      expect(useCases.createOrGetConversationUseCase.execute).toHaveBeenNthCalledWith(2, {
        buyerId: USER_ID,
        sellerId: 'seller-1',
        productId: 'p-1',
      });
      expect(res.status).toHaveBeenNthCalledWith(1, 201);
      expect(res.status).toHaveBeenNthCalledWith(2, 200);
    });

    it('forwards errors to next', async () => {
      const error = new Error('boom');
      useCases.createOrGetConversationUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.createConversation({ user: { id: USER_ID }, body: {} }, {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listConversations', () => {
    it('passes the user id and pagination to the use case', async () => {
      const result = { data: [], meta: {} };
      useCases.listConversationsUseCase.execute.mockResolvedValue(result);
      const res = createResponse();

      await controller.listConversations(
        { user: { id: USER_ID }, query: { page: '2', limit: '10' } },
        res,
        vi.fn()
      );

      expect(useCases.listConversationsUseCase.execute).toHaveBeenCalledWith({
        userId: USER_ID,
        page: '2',
        limit: '10',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('forwards errors to next', async () => {
      const error = new Error('boom');
      useCases.listConversationsUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.listConversations({ user: { id: USER_ID }, query: {} }, {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listMessages', () => {
    it('passes conversation, user and pagination to the use case', async () => {
      useCases.listMessagesUseCase.execute.mockResolvedValue({ data: [] });
      const res = createResponse();

      await controller.listMessages(
        {
          user: { id: USER_ID },
          params: { conversationId: CONVERSATION_ID },
          query: { page: '1', limit: '20' },
        },
        res,
        vi.fn()
      );

      expect(useCases.listMessagesUseCase.execute).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        userId: USER_ID,
        page: '1',
        limit: '20',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('forwards errors to next', async () => {
      const error = new Error('boom');
      useCases.listMessagesUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.listMessages(
        { user: { id: USER_ID }, params: { conversationId: CONVERSATION_ID }, query: {} },
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('sendMessage', () => {
    it('responds with 201 and forwards errors to next', async () => {
      useCases.sendMessageUseCase.execute.mockResolvedValueOnce({ data: { id: 'm-1' } });
      const res = createResponse();

      await controller.sendMessage(
        {
          user: { id: USER_ID },
          params: { conversationId: CONVERSATION_ID },
          body: { content: 'Hola' },
        },
        res,
        vi.fn()
      );

      expect(useCases.sendMessageUseCase.execute).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        senderId: USER_ID,
        content: 'Hola',
      });
      expect(res.status).toHaveBeenCalledWith(201);

      const error = new Error('boom');
      useCases.sendMessageUseCase.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.sendMessage({ user: { id: USER_ID }, params: {}, body: {} }, {}, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
