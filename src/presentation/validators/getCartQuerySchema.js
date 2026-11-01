import Joi from 'joi';

export const getCartQuerySchema = Joi.object({
  include: Joi.string().valid('product').optional(),
}).unknown(false);
