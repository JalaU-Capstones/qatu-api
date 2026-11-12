import Joi from 'joi';

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'shipped', 'delivered', 'cancelled').required().messages({
    'any.required': 'status is required',
    'any.only': 'status must be one of: confirmed, shipped, delivered, cancelled',
  }),
});
