import Joi from 'joi';
import { PAYMENT_METHODS, PHONE_PATTERN } from '../../application/dtos/CreateOrderDTO.js';

// The cart is not part of the body: it is read from the database for the buyer.
export const createOrderSchema = Joi.object({
  shipping_address: Joi.object({
    full_name: Joi.string().trim().min(2).max(100).required(),
    phone: Joi.string().trim().pattern(PHONE_PATTERN).required(),
    street: Joi.string().trim().min(3).max(200).required(),
    city: Joi.string().trim().min(2).max(100).required(),
    state: Joi.string().trim().max(100).allow('', null).optional(),
    postal_code: Joi.string().trim().max(20).allow('', null).optional(),
    country: Joi.string().trim().length(2).uppercase().required(),
  }).required(),
  payment_method: Joi.string()
    .valid(...PAYMENT_METHODS)
    .default('simulated'),
  notes: Joi.string().trim().max(500).allow('', null).optional(),
}).required();
