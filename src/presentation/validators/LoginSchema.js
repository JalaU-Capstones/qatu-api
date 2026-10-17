import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(1).required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
}).options({ stripUnknown: true });
