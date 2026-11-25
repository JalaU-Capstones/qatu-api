export class AdminCategoryController {
  constructor({ createCategoryUseCase, updateCategoryUseCase, deleteCategoryUseCase } = {}) {
    if (!createCategoryUseCase) {
      throw new Error('createCategoryUseCase is required');
    }
    if (!updateCategoryUseCase) {
      throw new Error('updateCategoryUseCase is required');
    }
    if (!deleteCategoryUseCase) {
      throw new Error('deleteCategoryUseCase is required');
    }
    this.createCategoryUseCase = createCategoryUseCase;
    this.updateCategoryUseCase = updateCategoryUseCase;
    this.deleteCategoryUseCase = deleteCategoryUseCase;
  }

  async create(req, res, next) {
    try {
      const body = req.validatedBody || req.body || {};
      const result = await this.createCategoryUseCase.execute({
        name: body.name,
        slug: body.slug,
        description: body.description,
        parent_id: body.parent_id,
      });
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const params = req.validatedParams || req.params || {};
      const body = req.validatedBody || req.body || {};
      const result = await this.updateCategoryUseCase.execute({
        categoryId: params.categoryId,
        ...body,
      });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const params = req.validatedParams || req.params || {};
      await this.deleteCategoryUseCase.execute({
        categoryId: params.categoryId,
      });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
}
