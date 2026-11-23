import Joi from 'joi';

export const adminListSellerApplicationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
});

export const adminReviewSellerApplicationParamsSchema = Joi.object({
  applicationId: Joi.string().uuid().required(),
});

export const adminReviewSellerApplicationBodySchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  rejection_reason: Joi.when('status', {
    is: 'rejected',
    then: Joi.string().trim().min(1).max(500).required().messages({
      'any.required': 'Rejection reason is required when status is rejected.',
      'string.empty': 'Rejection reason is required when status is rejected.',
    }),
    otherwise: Joi.string().trim().max(500).allow(null, '').optional(),
  }),
});
