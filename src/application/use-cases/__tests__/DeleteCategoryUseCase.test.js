import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteCategoryUseCase } from '../DeleteCategoryUseCase.js';

const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

describe('DeleteCategoryUseCase', () => {
  let categoryRepository;
  let useCase;

  beforeEach(() => {
    categoryRepository = {
      findById: vi.fn().mockResolvedValue({ id: CATEGORY_ID }),
      hasProducts: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(true),
    };
    useCase = new DeleteCategoryUseCase({ categoryRepository });
  });

  it('should throw when categoryRepository is missing', () => {
    expect(() => new DeleteCategoryUseCase()).toThrow('categoryRepository is required');
    expect(() => new DeleteCategoryUseCase({})).toThrow('categoryRepository is required');
  });

  it('should delete a category that has no products', async () => {
    const result = await useCase.execute({ categoryId: CATEGORY_ID });

    expect(result).toBeUndefined();
    expect(categoryRepository.findById).toHaveBeenCalledWith(CATEGORY_ID);
    expect(categoryRepository.hasProducts).toHaveBeenCalledWith(CATEGORY_ID);
    expect(categoryRepository.delete).toHaveBeenCalledWith(CATEGORY_ID);
  });

  it('should return 404 NOT_FOUND when the category does not exist', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ categoryId: CATEGORY_ID })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Category not found',
    });
    expect(categoryRepository.hasProducts).not.toHaveBeenCalled();
    expect(categoryRepository.delete).not.toHaveBeenCalled();
  });

  it('should return 409 CATEGORY_IN_USE when the category has products', async () => {
    categoryRepository.hasProducts.mockResolvedValue(true);

    await expect(useCase.execute({ categoryId: CATEGORY_ID })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CATEGORY_IN_USE',
      message: 'Category in use',
    });
    expect(categoryRepository.hasProducts).toHaveBeenCalledWith(CATEGORY_ID);
    expect(categoryRepository.delete).not.toHaveBeenCalled();
  });
});
