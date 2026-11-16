export class AdminSellerApplicationController {
  constructor({ adminListSellerApplicationsUseCase, adminReviewSellerApplicationUseCase } = {}) {
    if (!adminListSellerApplicationsUseCase) {
      throw new Error('adminListSellerApplicationsUseCase is required');
    }
    if (!adminReviewSellerApplicationUseCase) {
      throw new Error('adminReviewSellerApplicationUseCase is required');
    }
    this.adminListSellerApplicationsUseCase = adminListSellerApplicationsUseCase;
    this.adminReviewSellerApplicationUseCase = adminReviewSellerApplicationUseCase;
  }

  async list(req, res, next) {
    try {
      const query = req.validatedQuery || req.query || {};
      const result = await this.adminListSellerApplicationsUseCase.execute({
        status: query.status || null,
        page: query.page,
        limit: query.limit,
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async review(req, res, next) {
    try {
      const adminUserId = req.user?.id;
      const params = req.validatedParams || req.params || {};
      const body = req.validatedBody || req.body || {};

      const result = await this.adminReviewSellerApplicationUseCase.execute({
        applicationId: params.applicationId,
        adminUserId,
        status: body.status,
        rejectionReason: body.rejection_reason || null,
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
