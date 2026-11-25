import Joi from 'joi';

export const createConversationSchema = Joi.object({
  seller_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().allow(null).optional(),
});

export const listConversationsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const conversationIdParamSchema = Joi.object({
  conversationId: Joi.string().uuid().required(),
});

export const listMessagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});
