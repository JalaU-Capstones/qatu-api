import Joi from 'joi';

export const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).required().messages({
    'number.base': 'quantity must be a number',
    'number.integer': 'quantity must be an integer',
    'number.min': 'quantity cannot be negative',
    'any.required': 'quantity is required',
  }),
});
