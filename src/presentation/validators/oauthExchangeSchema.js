import Joi from 'joi';

export const oauthExchangeSchema = Joi.object({
  access_token: Joi.string().required().messages({
    'any.required': 'access_token is required',
    'string.empty': 'access_token cannot be empty',
  }),
  refresh_token: Joi.string().required().messages({
    'any.required': 'refresh_token is required',
    'string.empty': 'refresh_token cannot be empty',
  }),
}).unknown(false);

export default oauthExchangeSchema;
