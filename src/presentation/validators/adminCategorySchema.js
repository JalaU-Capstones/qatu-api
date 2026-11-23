import Joi from 'joi';

// eslint-disable-next-line security/detect-unsafe-regex
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const adminCategoryParamsSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
});

export const adminCreateCategoryBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required().messages({
    'string.empty': 'Category name is required.',
    'string.min': 'Category name must be between 2 and 80 characters.',
    'string.max': 'Category name must be between 2 and 80 characters.',
    'any.required': 'Category name is required.',
  }),
  slug: Joi.string().trim().lowercase().min(2).max(100).pattern(slugPattern).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  parent_id: Joi.string().uuid().allow(null).optional(),
});

export const adminUpdateCategoryBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional().messages({
    'string.empty': 'Category name cannot be empty.',
    'string.min': 'Category name must be between 2 and 80 characters.',
    'string.max': 'Category name must be between 2 and 80 characters.',
  }),
  slug: Joi.string().trim().lowercase().min(2).max(100).pattern(slugPattern).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  parent_id: Joi.string().uuid().allow(null).optional(),
}).min(1);
