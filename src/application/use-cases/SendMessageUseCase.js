import { buildMessageSentEvent } from '../../domain/events/MessageSent.js';
import { MessageDTO } from '../dtos/MessageDTO.js';

function createError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class SendMessageUseCase {
  constructor({ conversationRepository, messageRepository, outboxRepository, transactionManager }) {
    if (!conversationRepository) throw new Error('conversationRepository is required');
    if (!messageRepository) throw new Error('messageRepository is required');
    if (!outboxRepository) throw new Error('outboxRepository is required');
    if (!transactionManager) throw new Error('transactionManager is required');

    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.outboxRepository = outboxRepository;
    this.transactionManager = transactionManager;
  }

  async execute({ conversationId, senderId, content }) {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (trimmed.length === 0) {
      throw createError('Message content cannot be empty.', 422, 'VALIDATION_ERROR');
    }
    if (trimmed.length > 2000) {
      throw createError('Message content cannot exceed 2000 characters.', 422, 'VALIDATION_ERROR');
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw createError('Conversation not found.', 404, 'NOT_FOUND');
    }

    if (!conversation.isParticipant(senderId)) {
      throw createError('You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const recipientId = conversation.getRecipientId(senderId);

    const createdMessage = await this.transactionManager.run(async (transaction) => {
      const message = await this.messageRepository.create(
        {
          conversationId,
          senderId,
          content: trimmed,
        },
        { transaction }
      );

      await this.outboxRepository.enqueue(
        buildMessageSentEvent({
          message,
          conversation,
          recipientId,
        }),
        { transaction }
      );

      return message;
    });

    return {
      data: MessageDTO.fromEntity(createdMessage),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
