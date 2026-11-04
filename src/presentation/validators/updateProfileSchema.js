import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).optional().messages({
    'string.base': 'full_name must be a string',
    'string.empty': 'full_name cannot be empty',
    'string.min': 'full_name must be between 2 and 100 characters long',
    'string.max': 'full_name must be between 2 and 100 characters long',
  }),
  bio: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.base': 'bio must be a string',
    'string.max': 'bio must be at most 500 characters',
  }),
  avatar_path: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.base': 'avatar_path must be a string',
    'string.max': 'avatar_path must be at most 500 characters',
  }),
  locale: Joi.string().trim().min(2).max(10).optional().messages({
    'string.base': 'locale must be a string',
    'string.empty': 'locale cannot be empty',
    'string.min': 'locale must be between 2 and 10 characters long',
    'string.max': 'locale must be between 2 and 10 characters long',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one profile field must be provided',
  });
