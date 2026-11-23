import { ConversationDTO } from '../dtos/ConversationDTO.js';

function createError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class CreateOrGetConversationUseCase {
  constructor({ conversationRepository, profileRepository, productRepository }) {
    if (!conversationRepository) throw new Error('conversationRepository is required');
    if (!profileRepository) throw new Error('profileRepository is required');
    if (!productRepository) throw new Error('productRepository is required');

    this.conversationRepository = conversationRepository;
    this.profileRepository = profileRepository;
    this.productRepository = productRepository;
  }

  async execute({ buyerId, sellerId, productId = null }) {
    if (!buyerId || !sellerId) {
      throw createError('buyerId and sellerId are required.', 400, 'BAD_REQUEST');
    }

    if (buyerId === sellerId) {
      throw createError('You cannot start a conversation with yourself.', 422, 'SELF_CONVERSATION');
    }

    const seller = await this.profileRepository.findById(sellerId);
    if (!seller) {
      throw createError('Seller not found.', 404, 'NOT_FOUND');
    }

    const normalizedProductId = productId || null;
    if (normalizedProductId) {
      const product = await this.productRepository.findById(normalizedProductId);
      if (!product) {
        throw createError('Product not found.', 404, 'NOT_FOUND');
      }
      if (product.sellerId && product.sellerId !== sellerId) {
        throw createError(
          'The specified product does not belong to this seller.',
          422,
          'UNPROCESSABLE_ENTITY'
        );
      }
    }

    const { conversation, created } = await this.conversationRepository.findOrCreate({
      buyerId,
      sellerId,
      productId: normalizedProductId,
    });

    return {
      created,
      body: {
        data: ConversationDTO.fromEntity(conversation),
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
}
