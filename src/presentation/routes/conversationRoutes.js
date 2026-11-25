import { Router } from 'express';
import { CreateOrGetConversationUseCase } from '../../application/use-cases/CreateOrGetConversationUseCase.js';
import { ListConversationsUseCase } from '../../application/use-cases/ListConversationsUseCase.js';
import { ListMessagesUseCase } from '../../application/use-cases/ListMessagesUseCase.js';
import { SendMessageUseCase } from '../../application/use-cases/SendMessageUseCase.js';
import { SequelizeTransactionManager } from '../../infrastructure/persistence/SequelizeTransactionManager.js';
import { ConversationRepository } from '../../infrastructure/persistence/repositories/ConversationRepository.js';
import { MessageRepository } from '../../infrastructure/persistence/repositories/MessageRepository.js';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/OutboxRepository.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { ConversationController } from '../controllers/ConversationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsSchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from '../validators/conversationSchema.js';

export function createConversationRouter({
  conversationRepository = new ConversationRepository(),
  messageRepository = new MessageRepository(),
  profileRepository = new ProfileRepository(),
  productRepository = new ProductRepository(),
  outboxRepository = new OutboxRepository(),
  transactionManager = new SequelizeTransactionManager(),
  createOrGetConversationUseCase,
  listConversationsUseCase,
  listMessagesUseCase,
  sendMessageUseCase,
  conversationController,
} = {}) {
  const router = Router();

  const createOrGetUC =
    createOrGetConversationUseCase ||
    new CreateOrGetConversationUseCase({
      conversationRepository,
      profileRepository,
      productRepository,
    });

  const listConvUC =
    listConversationsUseCase || new ListConversationsUseCase({ conversationRepository });

  const listMsgUC =
    listMessagesUseCase ||
    new ListMessagesUseCase({
      conversationRepository,
      messageRepository,
    });

  const sendMsgUC =
    sendMessageUseCase ||
    new SendMessageUseCase({
      conversationRepository,
      messageRepository,
      outboxRepository,
      transactionManager,
    });

  const controller =
    conversationController ||
    new ConversationController({
      createOrGetConversationUseCase: createOrGetUC,
      listConversationsUseCase: listConvUC,
      listMessagesUseCase: listMsgUC,
      sendMessageUseCase: sendMsgUC,
    });

  router.get(
    '/',
    authMiddleware,
    validateRequest(listConversationsSchema, { source: 'query' }),
    (req, res, next) => controller.listConversations(req, res, next)
  );

  router.post('/', authMiddleware, validateRequest(createConversationSchema), (req, res, next) =>
    controller.createConversation(req, res, next)
  );

  router.get(
    '/:conversationId/messages',
    authMiddleware,
    validateRequest(conversationIdParamSchema, { source: 'params' }),
    validateRequest(listMessagesQuerySchema, { source: 'query' }),
    (req, res, next) => controller.listMessages(req, res, next)
  );

  router.post(
    '/:conversationId/messages',
    authMiddleware,
    validateRequest(conversationIdParamSchema, { source: 'params' }),
    validateRequest(sendMessageSchema),
    (req, res, next) => controller.sendMessage(req, res, next)
  );

  return router;
}

export const conversationRouter = createConversationRouter();
