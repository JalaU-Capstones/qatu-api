import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '../../../domain/entities/Category.js';
import { UpdateCategoryUseCase } from '../UpdateCategoryUseCase.js';

const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const OTHER_CATEGORY_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
const PARENT_ID = 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80';

const buildCategory = (overrides = {}) =>
  new Category({
    id: CATEGORY_ID,
    name: 'Electronics',
    slug: 'electronics',
    description: 'Gadgets',
    parent_id: null,
    position: 0,
    is_active: true,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });

describe('UpdateCategoryUseCase', () => {
  let categoryRepository;
  let useCase;

  beforeEach(() => {
    categoryRepository = {
      findById: vi.fn().mockResolvedValue(buildCategory()),
      findByName: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    useCase = new UpdateCategoryUseCase({ categoryRepository });
  });

  it('should throw when categoryRepository is missing', () => {
    expect(() => new UpdateCategoryUseCase()).toThrow('categoryRepository is required');
    expect(() => new UpdateCategoryUseCase({})).toThrow('categoryRepository is required');
  });

  it('should update the name and description successfully', async () => {
    categoryRepository.update.mockResolvedValue(
      buildCategory({ name: 'Consumer Electronics', description: 'Consumer gadgets' })
    );

    const result = await useCase.execute({
      categoryId: CATEGORY_ID,
      name: '  Consumer Electronics  ',
      description: '  Consumer gadgets  ',
    });

    expect(categoryRepository.findById).toHaveBeenCalledWith(CATEGORY_ID);
    expect(categoryRepository.findByName).toHaveBeenCalledWith('Consumer Electronics');
    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, {
      name: 'Consumer Electronics',
      description: 'Consumer gadgets',
    });
    expect(result.data).toMatchObject({
      id: CATEGORY_ID,
      name: 'Consumer Electronics',
      description: 'Consumer gadgets',
    });
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should clear the description when it is sent as null', async () => {
    categoryRepository.update.mockResolvedValue(buildCategory({ description: null }));

    await useCase.execute({ categoryId: CATEGORY_ID, description: null });

    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, { description: null });
  });

  it('should return 404 NOT_FOUND when the category does not exist', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ categoryId: CATEGORY_ID, name: 'Consumer Electronics' })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Category not found',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('should return 409 CONFLICT when the new name belongs to another category', async () => {
    categoryRepository.findByName.mockResolvedValue(buildCategory({ id: OTHER_CATEGORY_ID }));

    await expect(
      useCase.execute({ categoryId: CATEGORY_ID, name: 'Consumer Electronics' })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A category with this name already exists',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('should allow saving the same name of the category being updated', async () => {
    categoryRepository.findByName.mockResolvedValue(buildCategory({ id: CATEGORY_ID }));
    categoryRepository.update.mockResolvedValue(buildCategory());

    await useCase.execute({ categoryId: CATEGORY_ID, name: 'Electronics' });

    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, { name: 'Electronics' });
  });

  it('should return 409 CONFLICT when the new slug belongs to another category', async () => {
    categoryRepository.findBySlug.mockResolvedValue(buildCategory({ id: OTHER_CATEGORY_ID }));

    await expect(
      useCase.execute({ categoryId: CATEGORY_ID, slug: 'consumer-electronics' })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A category with this slug already exists',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('should allow saving the same slug of the category being updated', async () => {
    categoryRepository.findBySlug.mockResolvedValue(buildCategory({ id: CATEGORY_ID }));
    categoryRepository.update.mockResolvedValue(buildCategory());

    await useCase.execute({ categoryId: CATEGORY_ID, slug: 'electronics' });

    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, { slug: 'electronics' });
  });

  it('should return 422 UNPROCESSABLE_ENTITY when parent_id equals categoryId', async () => {
    await expect(
      useCase.execute({ categoryId: CATEGORY_ID, parent_id: CATEGORY_ID })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
      message: 'A category cannot be its own parent',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('should return 404 NOT_FOUND when the new parent does not exist', async () => {
    categoryRepository.findById.mockResolvedValueOnce(buildCategory()).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ categoryId: CATEGORY_ID, parent_id: PARENT_ID })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Parent category not found',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a non-string name and allow clearing the parent', async () => {
    categoryRepository.update.mockResolvedValue(buildCategory({ parent_id: null }));

    await expect(useCase.execute({ categoryId: CATEGORY_ID, name: 123 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Category name must be between 2 and 80 characters.',
    });

    await useCase.execute({ categoryId: CATEGORY_ID, parent_id: null });
    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, { parent_id: null });
  });

  it('should set a valid parent category', async () => {
    categoryRepository.findById
      .mockResolvedValueOnce(buildCategory())
      .mockResolvedValueOnce(buildCategory({ id: PARENT_ID }));
    categoryRepository.update.mockResolvedValue(buildCategory({ parent_id: PARENT_ID }));

    await useCase.execute({ categoryId: CATEGORY_ID, parent_id: PARENT_ID });

    expect(categoryRepository.update).toHaveBeenCalledWith(CATEGORY_ID, { parent_id: PARENT_ID });
  });

  it('should reject an invalid name with 400 VALIDATION_ERROR', async () => {
    await expect(useCase.execute({ categoryId: CATEGORY_ID, name: 'A' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Category name must be between 2 and 80 characters.',
    });
    expect(categoryRepository.findByName).not.toHaveBeenCalled();
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });
});
