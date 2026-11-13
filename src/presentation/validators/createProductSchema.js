import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'name is required',
    'string.min': 'name must be at least 3 characters long',
    'string.max': 'name must be at most 200 characters long',
    'any.required': 'name is required',
  }),
  slug: Joi.string()
    .trim()
    // eslint-disable-next-line security/detect-unsafe-regex
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .messages({
      'string.pattern.base': 'slug must use lowercase letters, numbers, and hyphens only',
    }),
  description: Joi.string().trim().max(5000).allow('').optional().messages({
    'string.max': 'description must be at most 5000 characters long',
  }),
  price: Joi.number().greater(0).required().messages({
    'number.base': 'price must be a number',
    'number.greater': 'price must be greater than zero',
    'any.required': 'price is required',
  }),
  currency: Joi.string()
    .uppercase()
    .valid('USD', 'EUR', 'BOB', 'PEN', 'ARS', 'COP', 'MXN', 'BRL')
    .default('USD')
    .optional(),
  stock: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'stock must be a number',
    'number.integer': 'stock must be an integer',
    'number.min': 'stock must be at least 0',
  }),
  category_id: Joi.string().trim().uuid().required().messages({
    'string.guid': 'category_id must be a valid UUID',
    'any.required': 'category_id is required',
  }),
  attributes: Joi.object().unknown(true).default({}),
}).unknown(false);
