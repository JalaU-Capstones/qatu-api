export class AdminReportController {
  /**
   * @param {Object} options
   * @param {import('../../application/use-cases/GetAdminSalesReportUseCase.js').GetAdminSalesReportUseCase} options.getSalesReportUseCase
   * @param {import('../../application/use-cases/GetAdminUsersReportUseCase.js').GetAdminUsersReportUseCase} options.getUsersReportUseCase
   * @param {import('../../application/use-cases/GetAdminProductsReportUseCase.js').GetAdminProductsReportUseCase} options.getProductsReportUseCase
   */
  constructor({ getSalesReportUseCase, getUsersReportUseCase, getProductsReportUseCase } = {}) {
    if (!getSalesReportUseCase) throw new Error('getSalesReportUseCase is required');
    if (!getUsersReportUseCase) throw new Error('getUsersReportUseCase is required');
    if (!getProductsReportUseCase) throw new Error('getProductsReportUseCase is required');
    this.getSalesReportUseCase = getSalesReportUseCase;
    this.getUsersReportUseCase = getUsersReportUseCase;
    this.getProductsReportUseCase = getProductsReportUseCase;
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async sales(req, res, next) {
    try {
      const query = req.validatedQuery || {};
      const result = await this.getSalesReportUseCase.execute({
        from: query.from,
        to: query.to,
        groupBy: query.group_by,
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async users(req, res, next) {
    try {
      const query = req.validatedQuery || {};
      const result = await this.getUsersReportUseCase.execute({
        from: query.from,
        to: query.to,
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async products(req, res, next) {
    try {
      const query = req.validatedQuery || {};
      const result = await this.getProductsReportUseCase.execute({
        from: query.from,
        to: query.to,
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
