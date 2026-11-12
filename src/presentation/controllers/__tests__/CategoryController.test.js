import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryController } from '../CategoryController.js';

describe('CategoryController', () => {
  let useCaseMock;
  let controller;

  beforeEach(() => {
    useCaseMock = { execute: vi.fn() };
    controller = new CategoryController({ listCategoriesUseCase: useCaseMock });
  });

  it('should throw if listCategoriesUseCase dependency is missing', () => {
    expect(() => new CategoryController({})).toThrow('listCategoriesUseCase is required');
    expect(() => new CategoryController()).toThrow('listCategoriesUseCase is required');
  });

  it('should respond with 200 and the use case result', async () => {
    const result = {
      data: [{ id: 'c1', name: 'Electronics' }],
      meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
    };
    useCaseMock.execute.mockResolvedValue(result);

    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const next = vi.fn();

    await controller.list({ validatedQuery: { page: 1, limit: 20 } }, { status }, next);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('should fall back to req.query when validatedQuery is absent', async () => {
    useCaseMock.execute.mockResolvedValue({ data: [], meta: {} });
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    await controller.list({ query: { page: '2', limit: '5' } }, { status }, vi.fn());

    const dto = useCaseMock.execute.mock.calls[0][0];
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(5);
  });

  it('should call next with the error when the use case throws', async () => {
    const error = new Error('boom');
    useCaseMock.execute.mockRejectedValue(error);
    const next = vi.fn();

    await controller.list({ validatedQuery: {} }, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
