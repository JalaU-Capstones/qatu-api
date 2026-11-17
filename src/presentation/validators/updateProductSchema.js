import Joi from 'joi';

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).optional().messages({
    'string.empty': 'name cannot be empty',
    'string.min': 'name must be at least 3 characters long',
    'string.max': 'name must be at most 200 characters long',
  }),
  description: Joi.string().trim().max(5000).allow('').optional().messages({
    'string.max': 'description must be at most 5000 characters long',
  }),
  price: Joi.number().greater(0).optional().messages({
    'number.base': 'price must be a number',
    'number.greater': 'price must be greater than zero',
  }),
  currency: Joi.string()
    .uppercase()
    .valid('USD', 'EUR', 'BOB', 'PEN', 'ARS', 'COP', 'MXN', 'BRL')
    .optional(),
  stock: Joi.number().integer().min(0).optional().messages({
    'number.base': 'stock must be a number',
    'number.integer': 'stock must be an integer',
    'number.min': 'stock must be at least 0',
  }),
  category_id: Joi.string().trim().uuid().optional().messages({
    'string.guid': 'category_id must be a valid UUID',
  }),
  attributes: Joi.object().unknown(true).optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    'object.min': 'At least one field is required',
    'object.missing': 'At least one field is required',
  });
