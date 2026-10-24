import Joi from 'joi';

export const addToCartSchema = Joi.object({
  product_id: Joi.string().uuid().required().messages({
    'string.guid': 'product_id must be a valid UUID',
    'string.empty': 'product_id is required',
    'any.required': 'product_id is required',
  }),
  quantity: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'quantity must be a number',
    'number.integer': 'quantity must be an integer',
    'number.min': 'quantity must be at least 1',
  }),
});
