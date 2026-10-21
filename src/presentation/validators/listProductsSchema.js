import Joi from 'joi';

export const listProductsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'page must be a number',
    'number.integer': 'page must be an integer',
    'number.min': 'page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'limit must be a number',
    'number.integer': 'limit must be an integer',
    'number.min': 'limit must be at least 1',
    'number.max': 'limit must be at most 100',
  }),
  search: Joi.string().trim().max(200).allow('', null).optional(),
  category_id: Joi.string().uuid().optional().messages({
    'string.guid': 'category_id must be a valid UUID',
  }),
  min_price: Joi.number().min(0).optional().messages({
    'number.base': 'min_price must be a number',
    'number.min': 'min_price must be at least 0',
  }),
  max_price: Joi.number()
    .min(0)
    .when('min_price', {
      is: Joi.exist(),
      then: Joi.number()
        .min(Joi.ref('min_price'))
        .messages({ 'number.min': 'max_price must be greater than or equal to min_price' }),
    })
    .optional()
    .messages({
      'number.base': 'max_price must be a number',
      'number.min': 'max_price must be at least 0',
    }),
  seller_id: Joi.string().uuid().optional().messages({
    'string.guid': 'seller_id must be a valid UUID',
  }),
  sort_by: Joi.string()
    .valid('created_at', 'price', 'name', 'average_rating')
    .default('created_at')
    .messages({
      'any.only': 'sort_by must be one of created_at, price, name, average_rating',
    }),
  sort_order: Joi.string().lowercase().valid('asc', 'desc').default('desc').messages({
    'any.only': 'sort_order must be one of asc, desc',
  }),
});
