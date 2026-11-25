import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '../../../domain/entities/Category.js';
import { CreateCategoryUseCase } from '../CreateCategoryUseCase.js';

const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const PARENT_ID = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';

const buildCategory = (overrides = {}) =>
  new Category({
    id: CATEGORY_ID,
    name: 'Electronics',
    slug: 'electronics',
    description: null,
    parent_id: null,
    position: 0,
    is_active: true,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });

describe('CreateCategoryUseCase', () => {
  let categoryRepository;
  let useCase;

  beforeEach(() => {
    categoryRepository = {
      findByName: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    };
    useCase = new CreateCategoryUseCase({ categoryRepository });
  });

  it('should throw when categoryRepository is missing', () => {
    expect(() => new CreateCategoryUseCase()).toThrow('categoryRepository is required');
    expect(() => new CreateCategoryUseCase({})).toThrow('categoryRepository is required');
  });

  it('pads a one-character auto-generated slug with the -cat suffix', async () => {
    categoryRepository.create.mockImplementation(async (entity) =>
      buildCategory({ slug: entity.slug })
    );

    await useCase.execute({ name: 'A!' });

    expect(categoryRepository.findBySlug).toHaveBeenCalledWith('a-cat');
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'a-cat' })
    );
  });

  it('should create a category with only a name and auto-generate the slug', async () => {
    categoryRepository.create.mockResolvedValue(buildCategory());

    const result = await useCase.execute({ name: '  Electronics  ' });

    expect(categoryRepository.findByName).toHaveBeenCalledWith('Electronics');
    expect(categoryRepository.findBySlug).toHaveBeenCalledWith('electronics');
    expect(categoryRepository.create).toHaveBeenCalledWith({
      name: 'Electronics',
      slug: 'electronics',
      description: null,
      parent_id: null,
    });
    expect(result.data).toMatchObject({
      id: CATEGORY_ID,
      name: 'Electronics',
      slug: 'electronics',
      description: null,
      parent_id: null,
    });
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('trims a provided description before persisting it', async () => {
    categoryRepository.create.mockResolvedValue(buildCategory({ description: 'Gadgets' }));

    const result = await useCase.execute({ name: 'Electronics', description: '  Gadgets  ' });

    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Gadgets' })
    );
    expect(result.data.description).toBe('Gadgets');
  });

  it('should resolve a slug collision by appending a numeric suffix', async () => {
    categoryRepository.findBySlug
      .mockResolvedValueOnce(buildCategory())
      .mockResolvedValueOnce(null);
    categoryRepository.create.mockResolvedValue(buildCategory({ slug: 'electronics-2' }));

    const result = await useCase.execute({ name: 'Electronics' });

    expect(categoryRepository.findBySlug).toHaveBeenNthCalledWith(1, 'electronics');
    expect(categoryRepository.findBySlug).toHaveBeenNthCalledWith(2, 'electronics-2');
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'electronics-2' })
    );
    expect(result.data.slug).toBe('electronics-2');
  });

  it('should keep incrementing the suffix until a free slug is found', async () => {
    categoryRepository.findBySlug
      .mockResolvedValueOnce(buildCategory())
      .mockResolvedValueOnce(buildCategory())
      .mockResolvedValueOnce(null);
    categoryRepository.create.mockResolvedValue(buildCategory({ slug: 'electronics-3' }));

    await useCase.execute({ name: 'Electronics' });

    expect(categoryRepository.findBySlug).toHaveBeenNthCalledWith(3, 'electronics-3');
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'electronics-3' })
    );
  });

  it('should use an explicitly provided slug', async () => {
    categoryRepository.create.mockResolvedValue(buildCategory({ slug: 'consumer-electronics' }));

    await useCase.execute({ name: 'Electronics', slug: '  Consumer-Electronics  ' });

    expect(categoryRepository.findBySlug).toHaveBeenCalledWith('consumer-electronics');
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'consumer-electronics' })
    );
  });

  it('should create a category under an existing parent', async () => {
    categoryRepository.findById.mockResolvedValue(buildCategory({ id: PARENT_ID }));
    categoryRepository.create.mockResolvedValue(buildCategory({ parent_id: PARENT_ID }));

    const result = await useCase.execute({ name: 'Electronics', parent_id: PARENT_ID });

    expect(categoryRepository.findById).toHaveBeenCalledWith(PARENT_ID);
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: PARENT_ID })
    );
    expect(result.data.parent_id).toBe(PARENT_ID);
  });

  it.each([
    ['shorter than 2 characters', 'A'],
    ['empty', ''],
    ['blank', '   '],
    ['longer than 80 characters', 'a'.repeat(81)],
    ['not a string', null],
  ])('should reject a name %s with 400 VALIDATION_ERROR', async (_label, name) => {
    await expect(useCase.execute({ name })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Category name must be between 2 and 80 characters.',
    });
    expect(categoryRepository.findByName).not.toHaveBeenCalled();
    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a duplicate name with 409 CONFLICT', async () => {
    categoryRepository.findByName.mockResolvedValue(buildCategory());

    await expect(useCase.execute({ name: 'Electronics' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A category with this name already exists',
    });
    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a duplicate explicit slug with 409 CONFLICT', async () => {
    categoryRepository.findBySlug.mockResolvedValue(buildCategory());

    await expect(
      useCase.execute({ name: 'Electronics', slug: 'electronics' })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A category with this slug already exists',
    });
    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a missing parent_id with 404 NOT_FOUND', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ name: 'Electronics', parent_id: PARENT_ID })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Parent category not found',
    });
    expect(categoryRepository.create).not.toHaveBeenCalled();
  });
});
