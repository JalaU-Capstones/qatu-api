import Joi from 'joi';

const isoDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required()
  .messages({
    'string.pattern.base': '{{#label}} must be a date in YYYY-MM-DD format.',
    'any.required': '{{#label}} is required.',
  });

export const adminSalesReportQuerySchema = Joi.object({
  from: isoDate,
  to: isoDate,
  group_by: Joi.string().valid('day', 'week', 'month').default('month'),
});

export const adminReportRangeQuerySchema = Joi.object({
  from: isoDate,
  to: isoDate,
});
