import Joi from 'joi';

export const applySellerSchema = Joi.object({
  business_name: Joi.string().trim().min(2).max(120).required().messages({
    'string.empty': 'Business name is required.',
    'string.min': 'Business name must be between 2 and 120 characters.',
    'string.max': 'Business name must be between 2 and 120 characters.',
    'any.required': 'Business name is required.',
  }),
  business_description: Joi.string().trim().min(20).max(2000).required().messages({
    'string.empty': 'Business description is required.',
    'string.min': 'Business description must be between 20 and 2000 characters.',
    'string.max': 'Business description must be between 20 and 2000 characters.',
    'any.required': 'Business description is required.',
  }),
  contact_phone: Joi.string().trim().max(40).allow(null, '').optional(),
  contact_email: Joi.string().trim().email().max(255).allow(null, '').optional(),
});
