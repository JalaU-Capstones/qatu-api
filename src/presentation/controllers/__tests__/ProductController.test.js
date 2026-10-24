import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductController } from '../ProductController.js';

describe('ProductController', () => {
  let useCaseMock;
  let getByIdUseCaseMock;
  let controller;

  beforeEach(() => {
    useCaseMock = {
      execute: vi.fn(),
    };
    getByIdUseCaseMock = {
      execute: vi.fn(),
    };
    controller = new ProductController({
      listProductsUseCase: useCaseMock,
      getProductByIdUseCase: getByIdUseCaseMock,
    });
  });

  it('should throw if listProductsUseCase dependency is missing in constructor', () => {
    expect(() => new ProductController({})).toThrow('listProductsUseCase is required');
  });

  it('should throw if no arguments are passed to constructor', () => {
    expect(() => new ProductController()).toThrow('listProductsUseCase is required');
  });

  describe('list', () => {
    it('should respond with 200 and use case result on success', async () => {
      const mockResult = {
        data: [
          { id: 'p1', name: 'Product 1', price: 9.99 },
          { id: 'p2', name: 'Product 2', price: 19.99 },
        ],
        meta: { page: 1, per_page: 20, total: 2, total_pages: 1 },
      };
      useCaseMock.execute.mockResolvedValue(mockResult);

      const req = {
        validatedQuery: { page: 1, limit: 20, sort_by: 'created_at', sort_order: 'desc' },
      };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      await controller.list(req, res, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(mockResult);
      expect(next).not.toHaveBeenCalled();
      expect(useCaseMock.execute).toHaveBeenCalledTimes(1);
    });

    it('should fall back to req.query when validatedQuery is absent', async () => {
      const mockResult = { data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } };
      useCaseMock.execute.mockResolvedValue(mockResult);

      const req = { query: { page: '2', limit: '10' } };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      await controller.list(req, res, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(useCaseMock.execute).toHaveBeenCalledTimes(1);
      const dto = useCaseMock.execute.mock.calls[0][0];
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(10);
    });

    it('should call next with error when use case throws', async () => {
      const error = new Error('Database connection failed');
      useCaseMock.execute.mockRejectedValue(error);

      const req = { validatedQuery: {} };
      const res = {};
      const next = vi.fn();

      await controller.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getById', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    it('should respond with 200 and product detail on success', async () => {
      const mockResult = {
        data: { id: productId, name: 'Product 1', price: 9.99, state: 'published' },
        meta: { timestamp: '2026-10-24T12:00:00.000Z' },
      };
      getByIdUseCaseMock.execute.mockResolvedValue(mockResult);

      const req = { params: { id: productId } };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      await controller.getById(req, res, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(mockResult);
      expect(getByIdUseCaseMock.execute).toHaveBeenCalledWith(productId);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with 404 error when product is not found or unpublished', async () => {
      const notFoundError = new Error('Product not found');
      notFoundError.code = 'PRODUCT_NOT_FOUND';
      notFoundError.statusCode = 404;
      getByIdUseCaseMock.execute.mockRejectedValue(notFoundError);

      const req = { params: { id: productId } };
      const res = {};
      const next = vi.fn();

      await controller.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
    });

    it('should call next with error if getProductByIdUseCase was not provided', async () => {
      const controllerWithoutGetById = new ProductController({
        listProductsUseCase: useCaseMock,
      });

      const req = { params: { id: productId } };
      const res = {};
      const next = vi.fn();

      await controllerWithoutGetById.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'getProductByIdUseCase is required' })
      );
    });
  });
});
