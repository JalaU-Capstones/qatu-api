import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductRequestDTO } from '../../../application/dtos/CreateProductDTO.js';
import { ProductController } from '../ProductController.js';

describe('ProductController', () => {
  let useCaseMock;
  let getByIdUseCaseMock;
  let createProductUseCaseMock;
  let publishProductUseCaseMock;
  let uploadProductImageUseCaseMock;
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
    publishProductUseCaseMock = {
      execute: vi.fn(),
    };
    uploadProductImageUseCaseMock = {
      execute: vi.fn(),
    };
    controller = new ProductController({
      listProductsUseCase: useCaseMock,
      getProductByIdUseCase: getByIdUseCaseMock,
      createProductUseCase: createProductUseCaseMock,
      publishProductUseCase: publishProductUseCaseMock,
      uploadProductImageUseCase: uploadProductImageUseCaseMock,
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

  describe('publish', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    it('responds with 200 and passes product and seller IDs to the use case', async () => {
      const result = {
        data: { id: productId, state: 'published', published_at: '2026-10-15T10:00:00.000Z' },
        meta: { timestamp: '2026-10-15T10:00:00.000Z' },
      };
      publishProductUseCaseMock.execute.mockResolvedValue(result);

      const req = {
        user: { id: 'seller-1', roles: ['seller'] },
        params: { id: productId },
      };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const next = vi.fn();

      await controller.publish(req, { status }, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(result);
      expect(publishProductUseCaseMock.execute).toHaveBeenCalledWith({
        productId,
        sellerId: 'seller-1',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes use case errors to next without responding', async () => {
      const error = Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      });
      publishProductUseCaseMock.execute.mockRejectedValue(error);

      const status = vi.fn();
      const next = vi.fn();
      await controller.publish(
        { user: { id: 'seller-1' }, params: { id: productId } },
        { status },
        next
      );

      expect(next).toHaveBeenCalledWith(error);
      expect(status).not.toHaveBeenCalled();
    });

    it('passes a missing dependency error to next', async () => {
      const controllerWithoutPublish = new ProductController({
        listProductsUseCase: useCaseMock,
      });
      const next = vi.fn();

      await controllerWithoutPublish.publish(
        { user: { id: 'seller-1' }, params: { id: productId } },
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'publishProductUseCase is required' })
      );
    });
  });

  describe('uploadImage', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    it('responds with 201 and serializes the created image envelope', async () => {
      const payload = {
        data: { id: 'img-1', product_id: productId, path: 'product-images/abc/cover.webp' },
        meta: { timestamp: '2026-10-15T10:00:00.000Z' },
        location: `/v1/products/${productId}/images/img-1`,
      };
      uploadProductImageUseCaseMock.execute.mockResolvedValue(payload);

      const req = {
        user: { id: 'seller-1', roles: ['seller'] },
        params: { id: productId },
        body: { alt_text: 'Front view', position: 0 },
        file: { buffer: Buffer.from('x'), size: 1, mimeType: 'image/png', originalName: 'a.png' },
      };
      const json = vi.fn();
      const locationMock = vi.fn().mockReturnValue({ json });
      const status = vi.fn().mockReturnValue({ location: locationMock, json });
      const next = vi.fn();

      await controller.uploadImage(req, { status }, next);

      expect(status).toHaveBeenCalledWith(201);
      expect(locationMock).toHaveBeenCalledWith(payload.location);
      expect(json).toHaveBeenCalledWith({ data: payload.data, meta: payload.meta });
      expect(uploadProductImageUseCaseMock.execute).toHaveBeenCalledWith({
        productId,
        sellerId: 'seller-1',
        file: req.file,
        altText: 'Front view',
        position: 0,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards use case errors without writing a response', async () => {
      const error = Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      });
      uploadProductImageUseCaseMock.execute.mockRejectedValue(error);

      const status = vi.fn();
      const next = vi.fn();

      await controller.uploadImage(
        { user: { id: 'seller-1' }, params: { id: productId }, file: { buffer: Buffer.from('x') } },
        { status },
        next
      );

      expect(next).toHaveBeenCalledWith(error);
      expect(status).not.toHaveBeenCalled();
    });

    it('passes a missing dependency error to next', async () => {
      const controllerWithoutUpload = new ProductController({
        listProductsUseCase: useCaseMock,
      });
      const next = vi.fn();

      await controllerWithoutUpload.uploadImage(
        { user: { id: 'seller-1' }, params: { id: productId }, file: { buffer: Buffer.from('x') } },
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'uploadProductImageUseCase is required' })
      );
    });
  });
});
