import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../middleware/errorHandler.js';
import { createAdminCategoryRouter } from '../adminCategoryRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    if (!req.headers['x-test-user-id']) {
      const err = new Error('Authentication required');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      return next(err);
    }
    req.user = { id: req.headers['x-test-user-id'] };
    return next();
  },
}));

vi.mock('../../middleware/requireAdminRole.js', () => ({
  requireAdminRole: () => (req, _res, next) => {
    if (req.headers['x-test-role'] !== 'admin') {
      const err = new Error('Admin role required');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      return next(err);
    }
    return next();
  },
}));

const CATEGORY_ID = 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const asAdmin = () => ({
  'x-test-user-id': 'admin-1',
  'x-test-role': 'admin',
});

describe('Admin category routes', () => {
  let app;
  let createCategoryUseCase;
  let updateCategoryUseCase;
  let deleteCategoryUseCase;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createCategoryUseCase = { execute: vi.fn() };
    updateCategoryUseCase = { execute: vi.fn() };
    deleteCategoryUseCase = { execute: vi.fn() };

    const router = createAdminCategoryRouter({
      createCategoryUseCase,
      updateCategoryUseCase,
      deleteCategoryUseCase,
    });

    app = express();
    app.use(express.json());
    app.use('/v1/admin/categories', router);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    const response = await request(app).post('/v1/admin/categories').send({ name: 'Electronics' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user is not an admin', async () => {
    const response = await request(app)
      .post('/v1/admin/categories')
      .set('x-test-user-id', 'buyer-1')
      .send({ name: 'Electronics' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when the name is shorter than 2 characters', async () => {
    const response = await request(app)
      .post('/v1/admin/categories')
      .set(asAdmin())
      .send({ name: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when :categoryId is not a valid UUID', async () => {
    const response = await request(app)
      .patch('/v1/admin/categories/not-a-uuid')
      .set(asAdmin())
      .send({ name: 'Consumer Electronics' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'categoryId' })])
    );
    expect(updateCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when a PATCH body is empty', async () => {
    const response = await request(app)
      .patch(`/v1/admin/categories/${CATEGORY_ID}`)
      .set(asAdmin())
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(updateCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('creates a category as an admin and returns 201', async () => {
    const result = {
      data: {
        id: CATEGORY_ID,
        name: 'Electronics',
        slug: 'electronics',
        description: null,
        parent_id: null,
      },
      meta: { timestamp: '2026-10-01T00:00:00.000Z' },
    };
    createCategoryUseCase.execute.mockResolvedValue(result);

    const response = await request(app)
      .post('/v1/admin/categories')
      .set(asAdmin())
      .send({ name: 'Electronics' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ id: CATEGORY_ID, name: 'Electronics' });
    expect(createCategoryUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Electronics' })
    );
  });

  it('updates a category as an admin and returns 200', async () => {
    const result = {
      data: { id: CATEGORY_ID, name: 'Consumer Electronics', slug: 'electronics' },
      meta: { timestamp: '2026-10-01T00:00:00.000Z' },
    };
    updateCategoryUseCase.execute.mockResolvedValue(result);

    const response = await request(app)
      .patch(`/v1/admin/categories/${CATEGORY_ID}`)
      .set(asAdmin())
      .send({ name: 'Consumer Electronics' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Consumer Electronics');
    expect(updateCategoryUseCase.execute).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      name: 'Consumer Electronics',
    });
  });

  it('deletes a category without products as an admin and returns 204', async () => {
    deleteCategoryUseCase.execute.mockResolvedValue(undefined);

    const response = await request(app)
      .delete(`/v1/admin/categories/${CATEGORY_ID}`)
      .set(asAdmin());

    expect(response.status).toBe(204);
    expect(deleteCategoryUseCase.execute).toHaveBeenCalledWith({ categoryId: CATEGORY_ID });
  });

  it('returns 409 with "Category in use" when the category has products', async () => {
    deleteCategoryUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Category in use'), {
        statusCode: 409,
        code: 'CATEGORY_IN_USE',
      })
    );

    const response = await request(app)
      .delete(`/v1/admin/categories/${CATEGORY_ID}`)
      .set(asAdmin());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CATEGORY_IN_USE');
    expect(response.body.error.message).toBe('Category in use');
    expect(deleteCategoryUseCase.execute).toHaveBeenCalledWith({ categoryId: CATEGORY_ID });
  });
});
