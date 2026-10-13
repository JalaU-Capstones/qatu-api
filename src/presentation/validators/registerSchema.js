import Joi from 'joi';
import { Password } from '../../domain/value-objects/Password.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),
  password: Joi.string().min(8).pattern(PASSWORD_REGEX).required().messages({
    'string.empty': Password.REQUIREMENTS_MESSAGE,
    'string.min': Password.REQUIREMENTS_MESSAGE,
    'string.pattern.base': Password.REQUIREMENTS_MESSAGE,
    'any.required': Password.REQUIREMENTS_MESSAGE,
  }),
  username: Joi.string().pattern(USERNAME_REGEX).required().messages({
    'string.empty': 'Username is required',
    'string.pattern.base':
      'Username must be between 3 and 30 characters and contain only alphanumeric characters and underscores.',
    'any.required': 'Username is required',
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Full name is required',
    'string.min': 'Full name must be between 2 and 100 characters long.',
    'string.max': 'Full name must be between 2 and 100 characters long.',
    'any.required': 'Full name is required',
  }),
});
