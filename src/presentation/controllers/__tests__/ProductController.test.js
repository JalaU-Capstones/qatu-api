import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductRequestDTO } from '../../../application/dtos/CreateProductDTO.js';
import { ProductController } from '../ProductController.js';

describe('ProductController', () => {
  let useCaseMock;
  let getByIdUseCaseMock;
  let createProductUseCaseMock;
  let controller;

  beforeEach(() => {
    useCaseMock = {
      execute: vi.fn(),
    };
    getByIdUseCaseMock = {
      execute: vi.fn(),
    };
    createProductUseCaseMock = {
      execute: vi.fn(),
    };
    controller = new ProductController({
      listProductsUseCase: useCaseMock,
      getProductByIdUseCase: getByIdUseCaseMock,
      createProductUseCase: createProductUseCaseMock,
    });
  });

  it('should throw if neither product use case dependency is provided in constructor', () => {
    expect(() => new ProductController({})).toThrow('at least one product use case is required');
  });

  it('should throw if no arguments are passed to constructor', () => {
    expect(() => new ProductController()).toThrow('at least one product use case is required');
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

  describe('create', () => {
    it('should respond with 201 and pass the authenticated seller id into the DTO', async () => {
      const mockResult = {
        data: { id: 'p1', name: 'X', slug: 'x' },
        meta: { timestamp: '2026-10-24T12:00:00.000Z' },
      };
      createProductUseCaseMock.execute.mockResolvedValue(mockResult);

      const req = {
        user: { id: 'seller-123', roles: ['seller'] },
        body: { name: 'X', price: 10, category_id: '11111111-1111-4111-8111-111111111111' },
      };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      await controller.create(req, res, next);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(mockResult);
      expect(createProductUseCaseMock.execute).toHaveBeenCalledTimes(1);
      const dto = createProductUseCaseMock.execute.mock.calls[0][0];
      expect(dto).toBeInstanceOf(CreateProductRequestDTO);
      expect(dto.sellerId).toBe('seller-123');
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with the thrown error when the use case fails', async () => {
      const error = new Error('boom');
      createProductUseCaseMock.execute.mockRejectedValue(error);

      const req = {
        user: { id: 'seller-123', roles: ['seller'] },
        body: { name: 'X', price: 10, category_id: '11111111-1111-4111-8111-111111111111' },
      };
      const res = { status: vi.fn() };
      const next = vi.fn();

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next with a missing dependency error when createProductUseCase is absent', async () => {
      const controllerWithoutCreate = new ProductController({
        listProductsUseCase: useCaseMock,
      });

      const req = {
        user: { id: 'seller-123', roles: ['seller'] },
        body: { name: 'X', price: 10, category_id: '11111111-1111-4111-8111-111111111111' },
      };
      const res = {};
      const next = vi.fn();

      await controllerWithoutCreate.create(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('createProductUseCase is required'),
        })
      );
    });
  });

  describe('getById', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    it('should respond with 200 and product detail response for public request', async () => {
      const mockResult = {
        data: { id: productId, name: 'Product 1', price: 9.99, state: 'published' },
        meta: { timestamp: '2026-10-24T12:00:00.000Z' },
      };
      getByIdUseCaseMock.execute.mockResolvedValue(mockResult);

      const req = { params: { id: productId }, user: null };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      await controller.getById(req, res, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(mockResult);
      expect(getByIdUseCaseMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ productId, currentUserId: null })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass req.user.id to the use case when request is authenticated', async () => {
      const mockResult = { data: { id: productId }, meta: {} };
      getByIdUseCaseMock.execute.mockResolvedValue(mockResult);

      const req = {
        params: { id: productId },
        user: { id: 'seller-123' },
      };
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await controller.getById(req, res, vi.fn());

      expect(getByIdUseCaseMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ productId, currentUserId: 'seller-123' })
      );
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
