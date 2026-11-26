import Joi from 'joi';

export const listNotificationsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  unread_only: Joi.boolean().default(false),
});

export const notificationIdParamSchema = Joi.object({
  notificationId: Joi.string().uuid().required(),
});
