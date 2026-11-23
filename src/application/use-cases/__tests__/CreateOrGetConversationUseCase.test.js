import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../../domain/entities/Conversation.js';
import { CreateOrGetConversationUseCase } from '../CreateOrGetConversationUseCase.js';

const BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SELLER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const OTHER_SELLER_ID = 'c2aaee11-2e2d-4ab0-9d8b-8dd1df502c33';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';
const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';

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

function expectHttpError(error, { statusCode, code }) {
  expect(error).toBeInstanceOf(Error);
  expect(error.statusCode).toBe(statusCode);
  expect(error.code).toBe(code);
}

describe('CreateOrGetConversationUseCase', () => {
  let conversationRepository;
  let profileRepository;
  let productRepository;
  let useCase;

  beforeEach(() => {
    conversationRepository = {
      findOrCreate: vi.fn(),
    };
    profileRepository = {
      findById: vi.fn().mockResolvedValue({ id: SELLER_ID }),
    };
    productRepository = {
      findById: vi.fn().mockResolvedValue({ id: PRODUCT_ID, sellerId: SELLER_ID }),
    };

    useCase = new CreateOrGetConversationUseCase({
      conversationRepository,
      profileRepository,
      productRepository,
    });
  });

  describe('constructor', () => {
    it('requires a conversation repository', () => {
      expect(
        () =>
          new CreateOrGetConversationUseCase({
            profileRepository,
            productRepository,
          })
      ).toThrow('conversationRepository is required');
    });

    it('requires a profile repository', () => {
      expect(
        () =>
          new CreateOrGetConversationUseCase({
            conversationRepository,
            productRepository,
          })
      ).toThrow('profileRepository is required');
    });

    it('requires a product repository', () => {
      expect(
        () =>
          new CreateOrGetConversationUseCase({
            conversationRepository,
            profileRepository,
          })
      ).toThrow('productRepository is required');
    });
  });

  describe('when no conversation exists yet', () => {
    it('creates the conversation and returns created: true with the DTO body', async () => {
      conversationRepository.findOrCreate.mockResolvedValue({
        conversation: makeConversation(),
        created: true,
      });

      const result = await useCase.execute({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(conversationRepository.findOrCreate).toHaveBeenCalledWith({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(result.created).toBe(true);
      expect(result.body.data).toEqual({
        id: CONVERSATION_ID,
        buyer_id: BUYER_ID,
        seller_id: SELLER_ID,
        product_id: PRODUCT_ID,
        last_message_at: null,
        created_at: '2026-11-23T09:00:00.000Z',
        updated_at: '2026-11-23T09:00:00.000Z',
      });
      expect(new Date(result.body.meta.timestamp).toISOString()).toBe(result.body.meta.timestamp);
    });

    it('normalizes a missing productId to null', async () => {
      conversationRepository.findOrCreate.mockResolvedValue({
        conversation: makeConversation({ productId: null }),
        created: true,
      });

      const result = await useCase.execute({ buyerId: BUYER_ID, sellerId: SELLER_ID });

      expect(productRepository.findById).not.toHaveBeenCalled();
      expect(conversationRepository.findOrCreate).toHaveBeenCalledWith({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: null,
      });
      expect(result.body.data.product_id).toBeNull();
    });

    it('accepts a product without an owner reference', async () => {
      productRepository.findById.mockResolvedValue({ id: PRODUCT_ID, sellerId: null });
      conversationRepository.findOrCreate.mockResolvedValue({
        conversation: makeConversation(),
        created: true,
      });

      const result = await useCase.execute({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(result.created).toBe(true);
    });
  });

  describe('when the conversation already exists', () => {
    it('reuses it and returns created: false', async () => {
      conversationRepository.findOrCreate.mockResolvedValue({
        conversation: makeConversation(),
        created: false,
      });

      const result = await useCase.execute({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        productId: PRODUCT_ID,
      });

      expect(result.created).toBe(false);
      expect(conversationRepository.findOrCreate).toHaveBeenCalledTimes(1);
      expect(result.body.data.id).toBe(CONVERSATION_ID);
    });
  });

  describe('validation', () => {
    it('rejects a conversation with oneself with 422 SELF_CONVERSATION', async () => {
      const error = await useCase
        .execute({ buyerId: BUYER_ID, sellerId: BUYER_ID })
        .catch((err) => err);

      expectHttpError(error, { statusCode: 422, code: 'SELF_CONVERSATION' });
      expect(profileRepository.findById).not.toHaveBeenCalled();
      expect(conversationRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it('rejects a request without buyerId or sellerId with 400 BAD_REQUEST', async () => {
      await expect(useCase.execute({ sellerId: SELLER_ID })).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
      await expect(useCase.execute({ buyerId: BUYER_ID })).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
      expect(conversationRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it('returns 404 NOT_FOUND when the seller does not exist', async () => {
      profileRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ buyerId: BUYER_ID, sellerId: SELLER_ID })
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

      expect(conversationRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it('returns 404 NOT_FOUND when the product does not exist', async () => {
      productRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          productId: PRODUCT_ID,
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

      expect(conversationRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it('returns 422 UNPROCESSABLE_ENTITY when the product belongs to another seller', async () => {
      productRepository.findById.mockResolvedValue({
        id: PRODUCT_ID,
        sellerId: OTHER_SELLER_ID,
      });

      const error = await useCase
        .execute({ buyerId: BUYER_ID, sellerId: SELLER_ID, productId: PRODUCT_ID })
        .catch((err) => err);

      expectHttpError(error, { statusCode: 422, code: 'UNPROCESSABLE_ENTITY' });
      expect(conversationRepository.findOrCreate).not.toHaveBeenCalled();
    });
  });
});
