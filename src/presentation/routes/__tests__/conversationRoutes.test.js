import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { createConversationRouter } from '../conversationRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

const BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SELLER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';
const MESSAGE_ID = 'a6eecd55-6c61-4ef4-db2f-2b15bc946a77';

const VALID_TOKEN = 'valid-supabase-token';
const INVALID_TOKEN = 'invalid-supabase-token';

const withAuth = (testRequest, token = VALID_TOKEN) =>
  testRequest.set('Authorization', `Bearer ${token}`);

function createHttpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

describe('Conversation routes', () => {
  let app;
  let createOrGetConversationUseCase;
  let listConversationsUseCase;
  let listMessagesUseCase;
  let sendMessageUseCase;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === VALID_TOKEN) {
        return {
          data: {
            user: {
              id: BUYER_ID,
              email: 'buyer@example.com',
              role: 'authenticated',
              user_metadata: { role: 'buyer' },
            },
          },
          error: null,
        };
      }

      return { data: { user: null }, error: { message: 'invalid token' } };
    });

    createOrGetConversationUseCase = { execute: vi.fn() };
    listConversationsUseCase = { execute: vi.fn() };
    listMessagesUseCase = { execute: vi.fn() };
    sendMessageUseCase = { execute: vi.fn() };

    const router = createConversationRouter({
      createOrGetConversationUseCase,
      listConversationsUseCase,
      listMessagesUseCase,
      sendMessageUseCase,
    });

    app = createApp({ conversationRoutes: router });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authentication', () => {
    it.each([
      ['GET', '/v1/conversations'],
      ['POST', '/v1/conversations'],
      ['GET', `/v1/conversations/${CONVERSATION_ID}/messages`],
      ['POST', `/v1/conversations/${CONVERSATION_ID}/messages`],
    ])('returns 401 for %s %s without a token', async (method, path) => {
      const testRequest = request(app)[method.toLowerCase()](path);

      if (method === 'POST') {
        testRequest.send(
          path.endsWith('/messages') ? { content: 'Hola' } : { seller_id: SELLER_ID }
        );
      }

      const response = await testRequest;

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(createOrGetConversationUseCase.execute).not.toHaveBeenCalled();
      expect(listConversationsUseCase.execute).not.toHaveBeenCalled();
      expect(listMessagesUseCase.execute).not.toHaveBeenCalled();
      expect(sendMessageUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 401 for an invalid Bearer token', async () => {
      const response = await withAuth(request(app).get('/v1/conversations'), INVALID_TOKEN);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(listConversationsUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('request validation', () => {
    it('returns 400 when POST /v1/conversations has no seller_id', async () => {
      const response = await withAuth(request(app).post('/v1/conversations')).send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'seller_id' })])
      );
      expect(createOrGetConversationUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when seller_id is not a UUID', async () => {
      const response = await withAuth(request(app).post('/v1/conversations')).send({
        seller_id: 'not-a-uuid',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'seller_id' })])
      );
      expect(createOrGetConversationUseCase.execute).not.toHaveBeenCalled();
    });

    it.each([
      ['GET', `/v1/conversations/not-a-uuid/messages`],
      ['POST', `/v1/conversations/not-a-uuid/messages`],
    ])('returns 400 for a non-UUID conversationId on %s %s', async (method, path) => {
      const testRequest = withAuth(request(app)[method.toLowerCase()](path));
      if (method === 'POST') {
        testRequest.send({ content: 'Hola' });
      }

      const response = await testRequest;

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'conversationId' })])
      );
      expect(listMessagesUseCase.execute).not.toHaveBeenCalled();
      expect(sendMessageUseCase.execute).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty string', ''],
      ['only whitespace', '   '],
      ['more than 2000 characters', 'a'.repeat(2001)],
    ])('returns 400 when content is %s', async (_label, content) => {
      const response = await withAuth(
        request(app).post(`/v1/conversations/${CONVERSATION_ID}/messages`)
      ).send({ content });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'content' })])
      );
      expect(sendMessageUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /v1/conversations', () => {
    it('returns 201 when a new conversation is created', async () => {
      const timestamp = '2026-11-23T10:00:00.000Z';
      createOrGetConversationUseCase.execute.mockResolvedValue({
        created: true,
        body: {
          data: {
            id: CONVERSATION_ID,
            buyer_id: BUYER_ID,
            seller_id: SELLER_ID,
            product_id: PRODUCT_ID,
            last_message_at: null,
            created_at: timestamp,
            updated_at: timestamp,
          },
          meta: { timestamp },
        },
      });

      const response = await withAuth(request(app).post('/v1/conversations')).send({
        seller_id: SELLER_ID,
        product_id: PRODUCT_ID,
      });

      expect(response.status).toBe(201);
      expect(createOrGetConversationUseCase.execute).toHaveBeenCalledWith({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });
      expect(response.body).toEqual({
        data: {
          id: CONVERSATION_ID,
          buyer_id: BUYER_ID,
          seller_id: SELLER_ID,
          product_id: PRODUCT_ID,
          last_message_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        },
        meta: { timestamp },
      });
    });

    it('returns 200 when an existing conversation is reused', async () => {
      createOrGetConversationUseCase.execute.mockResolvedValue({
        created: false,
        body: {
          data: {
            id: CONVERSATION_ID,
            buyer_id: BUYER_ID,
            seller_id: SELLER_ID,
            product_id: null,
            last_message_at: null,
            created_at: '2026-11-23T09:00:00.000Z',
            updated_at: '2026-11-23T09:00:00.000Z',
          },
          meta: { timestamp: '2026-11-23T10:00:00.000Z' },
        },
      });

      const response = await withAuth(request(app).post('/v1/conversations')).send({
        seller_id: SELLER_ID,
      });

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(CONVERSATION_ID);
      expect(createOrGetConversationUseCase.execute).toHaveBeenCalledWith({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: null,
      });
    });

    it('returns 422 SELF_CONVERSATION when the buyer targets themselves', async () => {
      createOrGetConversationUseCase.execute.mockRejectedValue(
        createHttpError('You cannot start a conversation with yourself.', 422, 'SELF_CONVERSATION')
      );

      const response = await withAuth(request(app).post('/v1/conversations')).send({
        seller_id: BUYER_ID,
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('SELF_CONVERSATION');
      expect(response.body.meta.timestamp).toBeDefined();
    });

    it('returns 404 when the seller does not exist', async () => {
      createOrGetConversationUseCase.execute.mockRejectedValue(
        createHttpError('Seller not found.', 404, 'NOT_FOUND')
      );

      const response = await withAuth(request(app).post('/v1/conversations')).send({
        seller_id: SELLER_ID,
      });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /v1/conversations', () => {
    it('returns 200 with the current user conversations', async () => {
      const payload = {
        data: [
          {
            id: CONVERSATION_ID,
            buyer_id: BUYER_ID,
            seller_id: SELLER_ID,
            product_id: PRODUCT_ID,
            last_message_at: null,
            created_at: '2026-11-23T09:00:00.000Z',
            updated_at: '2026-11-23T09:00:00.000Z',
          },
        ],
        meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      };
      listConversationsUseCase.execute.mockResolvedValue(payload);

      const response = await withAuth(request(app).get('/v1/conversations'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(payload);
      expect(listConversationsUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: BUYER_ID })
      );
    });
  });

  describe('GET /v1/conversations/:conversationId/messages', () => {
    it('returns 200 with the conversation messages', async () => {
      const payload = {
        data: [
          {
            id: MESSAGE_ID,
            conversation_id: CONVERSATION_ID,
            sender_id: SELLER_ID,
            content: 'Sí, está disponible.',
            read_at: null,
            edited_at: null,
            deleted_at: null,
            created_at: '2026-11-23T10:30:00.000Z',
          },
        ],
        meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      };
      listMessagesUseCase.execute.mockResolvedValue(payload);

      const response = await withAuth(
        request(app).get(`/v1/conversations/${CONVERSATION_ID}/messages`)
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(payload);
      expect(listMessagesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: CONVERSATION_ID,
          userId: BUYER_ID,
        })
      );
    });

    it('returns 403 when the user is not a participant', async () => {
      listMessagesUseCase.execute.mockRejectedValue(
        createHttpError('You are not a participant in this conversation.', 403, 'FORBIDDEN')
      );

      const response = await withAuth(
        request(app).get(`/v1/conversations/${CONVERSATION_ID}/messages`)
      );

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when the conversation does not exist', async () => {
      listMessagesUseCase.execute.mockRejectedValue(
        createHttpError('Conversation not found.', 404, 'NOT_FOUND')
      );

      const response = await withAuth(
        request(app).get(`/v1/conversations/${CONVERSATION_ID}/messages`)
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /v1/conversations/:conversationId/messages', () => {
    it('returns 201 when the participant sends a message', async () => {
      const payload = {
        data: {
          id: MESSAGE_ID,
          conversation_id: CONVERSATION_ID,
          sender_id: BUYER_ID,
          content: 'Hola, ¿sigue disponible?',
          read_at: null,
          edited_at: null,
          deleted_at: null,
          created_at: '2026-11-23T10:30:00.000Z',
        },
        meta: { timestamp: '2026-11-23T10:30:00.000Z' },
      };
      sendMessageUseCase.execute.mockResolvedValue(payload);

      const response = await withAuth(
        request(app).post(`/v1/conversations/${CONVERSATION_ID}/messages`)
      ).send({ content: 'Hola, ¿sigue disponible?' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(payload);
      expect(sendMessageUseCase.execute).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        senderId: BUYER_ID,
        content: 'Hola, ¿sigue disponible?',
      });
    });

    it('returns 403 when the user is not a participant', async () => {
      sendMessageUseCase.execute.mockRejectedValue(
        createHttpError('You are not a participant in this conversation.', 403, 'FORBIDDEN')
      );

      const response = await withAuth(
        request(app).post(`/v1/conversations/${CONVERSATION_ID}/messages`)
      ).send({ content: 'Hola' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
