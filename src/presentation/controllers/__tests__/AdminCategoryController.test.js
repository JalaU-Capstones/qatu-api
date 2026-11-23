import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCategoryController } from '../AdminCategoryController.js';

const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

function createMockResponse() {
  const json = vi.fn();
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send });
  return { status, json, send };
}

describe('AdminCategoryController', () => {
  let createCategoryUseCase;
  let updateCategoryUseCase;
  let deleteCategoryUseCase;
  let controller;

  beforeEach(() => {
    createCategoryUseCase = { execute: vi.fn() };
    updateCategoryUseCase = { execute: vi.fn() };
    deleteCategoryUseCase = { execute: vi.fn() };
    controller = new AdminCategoryController({
      createCategoryUseCase,
      updateCategoryUseCase,
      deleteCategoryUseCase,
    });
  });

  it('should require all three use cases in the constructor', () => {
    expect(() => new AdminCategoryController()).toThrow('createCategoryUseCase is required');
    expect(() => new AdminCategoryController({ createCategoryUseCase })).toThrow(
      'updateCategoryUseCase is required'
    );
    expect(
      () => new AdminCategoryController({ createCategoryUseCase, updateCategoryUseCase })
    ).toThrow('deleteCategoryUseCase is required');
  });

  describe('create', () => {
    it('should respond with 201 and the use case result', async () => {
      const result = {
        data: { id: CATEGORY_ID, name: 'Electronics', slug: 'electronics' },
        meta: { timestamp: '2026-10-01T00:00:00.000Z' },
      };
      createCategoryUseCase.execute.mockResolvedValue(result);

      const req = {
        body: {
          name: 'Electronics',
          slug: 'electronics',
          description: 'Gadgets',
          parent_id: null,
        },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await controller.create(req, res, next);

      expect(createCategoryUseCase.execute).toHaveBeenCalledWith({
        name: 'Electronics',
        slug: 'electronics',
        description: 'Gadgets',
        parent_id: null,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    it('should prefer req.validatedBody over req.body', async () => {
      createCategoryUseCase.execute.mockResolvedValue({ data: {}, meta: {} });
      const req = {
        body: { name: 'Unvalidated' },
        validatedBody: { name: 'Validated' },
      };
      const res = createMockResponse();

      await controller.create(req, res, vi.fn());

      expect(createCategoryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Validated' })
      );
    });

    it('should forward errors to next', async () => {
      const error = Object.assign(new Error('conflict'), { statusCode: 409, code: 'CONFLICT' });
      createCategoryUseCase.execute.mockRejectedValue(error);
      const res = createMockResponse();
      const next = vi.fn();

      await controller.create({ body: { name: 'Electronics' } }, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should respond with 200 and pass the params and body to the use case', async () => {
      const result = {
        data: { id: CATEGORY_ID, name: 'Consumer Electronics' },
        meta: { timestamp: '2026-10-01T00:00:00.000Z' },
      };
      updateCategoryUseCase.execute.mockResolvedValue(result);

      const req = {
        params: { categoryId: CATEGORY_ID },
        body: { name: 'Consumer Electronics' },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await controller.update(req, res, next);

      expect(updateCategoryUseCase.execute).toHaveBeenCalledWith({
        categoryId: CATEGORY_ID,
        name: 'Consumer Electronics',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    it('should prefer validated params and body when present', async () => {
      updateCategoryUseCase.execute.mockResolvedValue({ data: {}, meta: {} });
      const req = {
        params: { categoryId: 'raw' },
        body: { name: 'Raw' },
        validatedParams: { categoryId: CATEGORY_ID },
        validatedBody: { name: 'Validated' },
      };
      const res = createMockResponse();

      await controller.update(req, res, vi.fn());

      expect(updateCategoryUseCase.execute).toHaveBeenCalledWith({
        categoryId: CATEGORY_ID,
        name: 'Validated',
      });
    });

    it('should forward errors to next', async () => {
      const error = Object.assign(new Error('not found'), { statusCode: 404, code: 'NOT_FOUND' });
      updateCategoryUseCase.execute.mockRejectedValue(error);
      const res = createMockResponse();
      const next = vi.fn();

      await controller.update(
        { params: { categoryId: CATEGORY_ID }, body: { name: 'Updated' } },
        res,
        next
      );

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should respond with 204 without a body', async () => {
      deleteCategoryUseCase.execute.mockResolvedValue(undefined);

      const req = { params: { categoryId: CATEGORY_ID } };
      const res = createMockResponse();
      const next = vi.fn();

      await controller.delete(req, res, next);

      expect(deleteCategoryUseCase.execute).toHaveBeenCalledWith({ categoryId: CATEGORY_ID });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should forward errors to next', async () => {
      const error = Object.assign(new Error('Category in use'), {
        statusCode: 409,
        code: 'CATEGORY_IN_USE',
      });
      deleteCategoryUseCase.execute.mockRejectedValue(error);
      const res = createMockResponse();
      const next = vi.fn();

      await controller.delete({ params: { categoryId: CATEGORY_ID } }, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
