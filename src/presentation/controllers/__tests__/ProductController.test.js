import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductRequestDTO } from '../../../application/dtos/CreateProductDTO.js';
import { ProductController } from '../ProductController.js';

describe('ProductController', () => {
  let useCaseMock;
  let getByIdUseCaseMock;
  let createProductUseCaseMock;
  let publishProductUseCaseMock;
  let uploadProductImageUseCaseMock;
  let listProductImagesUseCaseMock;
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
    listProductImagesUseCaseMock = {
      execute: vi.fn(),
    };
    controller = new ProductController({
      listProductsUseCase: useCaseMock,
      getProductByIdUseCase: getByIdUseCaseMock,
      createProductUseCase: createProductUseCaseMock,
      publishProductUseCase: publishProductUseCaseMock,
      uploadProductImageUseCase: uploadProductImageUseCaseMock,
      listProductImagesUseCase: listProductImagesUseCaseMock,
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
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
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
      expect(dto.sellerId).toBe('00000000-0000-4000-8000-000000000002');
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with the thrown error when the use case fails', async () => {
      const error = new Error('boom');
      createProductUseCaseMock.execute.mockRejectedValue(error);

      const req = {
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
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
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
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
        user: { id: '00000000-0000-4000-8000-000000000002' },
      };
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await controller.getById(req, res, vi.fn());

      expect(getByIdUseCaseMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          currentUserId: '00000000-0000-4000-8000-000000000002',
        })
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
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
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
        sellerId: '00000000-0000-4000-8000-000000000002',
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
        { user: { id: '00000000-0000-4000-8000-000000000002' }, params: { id: productId } },
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
        { user: { id: '00000000-0000-4000-8000-000000000002' }, params: { id: productId } },
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

    it('reads req.cookies.access_token and passes it to the use case', async () => {
      const payload = {
        data: { id: 'img-1', product_id: productId, path: 'product-images/abc/cover.webp' },
        meta: { timestamp: '2026-10-15T10:00:00.000Z' },
        location: `/v1/products/${productId}/images/img-1`,
      };
      uploadProductImageUseCaseMock.execute.mockResolvedValue(payload);

      const req = {
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
        params: { id: productId },
        body: { alt_text: 'Front view', position: 0 },
        file: { buffer: Buffer.from('x'), size: 1, mimeType: 'image/png', originalName: 'a.png' },
        cookies: { access_token: 'cookie-access-token' },
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
        sellerId: '00000000-0000-4000-8000-000000000002',
        file: req.file,
        altText: 'Front view',
        position: 0,
        accessToken: 'cookie-access-token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('falls back to req.headers.authorization Bearer if cookie is missing', async () => {
      const payload = {
        data: { id: 'img-1', product_id: productId, path: 'product-images/abc/cover.webp' },
        meta: { timestamp: '2026-10-15T10:00:00.000Z' },
        location: `/v1/products/${productId}/images/img-1`,
      };
      uploadProductImageUseCaseMock.execute.mockResolvedValue(payload);

      const req = {
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
        params: { id: productId },
        body: { alt_text: 'Front view', position: 0 },
        file: { buffer: Buffer.from('x'), size: 1, mimeType: 'image/png', originalName: 'a.png' },
        cookies: {},
        headers: { authorization: 'Bearer bearer-access-token' },
      };
      const json = vi.fn();
      const locationMock = vi.fn().mockReturnValue({ json });
      const status = vi.fn().mockReturnValue({ location: locationMock, json });
      const next = vi.fn();

      await controller.uploadImage(req, { status }, next);

      expect(status).toHaveBeenCalledWith(201);
      expect(uploadProductImageUseCaseMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'bearer-access-token',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 UNAUTHORIZED when both cookie and Bearer are missing', async () => {
      const req = {
        user: { id: '00000000-0000-4000-8000-000000000002', roles: ['seller'] },
        params: { id: productId },
        file: { buffer: Buffer.from('x'), size: 1, mimeType: 'image/png', originalName: 'a.png' },
        cookies: {},
        headers: {},
      };
      const next = vi.fn();

      await controller.uploadImage(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
          message: 'Session token not available for storage upload',
        })
      );
      expect(uploadProductImageUseCaseMock.execute).not.toHaveBeenCalled();
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
        {
          user: { id: '00000000-0000-4000-8000-000000000002' },
          params: { id: productId },
          file: { buffer: Buffer.from('x') },
          cookies: { access_token: 'valid-token' },
        },
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
        {
          user: { id: '00000000-0000-4000-8000-000000000002' },
          params: { id: productId },
          file: { buffer: Buffer.from('x') },
        },
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'uploadProductImageUseCase is required' })
      );
    });
  });

  describe('listImages', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    it('responds with 200 and returns images from the use case', async () => {
      const mockResult = {
        data: [
          {
            id: 'img-1',
            product_id: productId,
            path: 'http://localhost:54321/storage/v1/object/public/product-images/abc/cover.webp',
            alt_text: null,
            position: 0,
            created_at: '2026-10-24T12:00:00.000Z',
          },
        ],
        meta: { timestamp: '2026-10-24T12:00:00.000Z' },
      };
      listProductImagesUseCaseMock.execute.mockResolvedValue(mockResult);

      const req = { params: { id: productId } };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const next = vi.fn();

      await controller.listImages(req, { status }, next);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(mockResult);
      expect(listProductImagesUseCaseMock.execute).toHaveBeenCalledWith({ productId });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes use case errors to next without responding', async () => {
      const error = Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      });
      listProductImagesUseCaseMock.execute.mockRejectedValue(error);

      const status = vi.fn();
      const next = vi.fn();

      await controller.listImages({ params: { id: productId } }, { status }, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(status).not.toHaveBeenCalled();
    });

    it('passes a missing dependency error to next when listProductImagesUseCase is absent', async () => {
      const controllerWithoutListImages = new ProductController({
        listProductsUseCase: useCaseMock,
      });
      const next = vi.fn();

      await controllerWithoutListImages.listImages({ params: { id: productId } }, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'listProductImagesUseCase is required' })
      );
    });
  });
});

const SELLER_ID = '00000000-0000-4000-8000-000000000002';
const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';

function createResponse() {
  const json = vi.fn();
  const end = vi.fn();
  const location = vi.fn().mockReturnValue({ json });
  const status = vi.fn().mockReturnValue({ json, end, location });
  return { status, json, end, location };
}

const sellerReq = (overrides = {}) => ({
  user: { id: SELLER_ID, roles: ['seller'] },
  ...overrides,
});

describe('ProductController — remaining branches', () => {
  let useCases;
  let controller;

  beforeEach(() => {
    useCases = {
      listProductsUseCase: { execute: vi.fn() },
      listSellerProductsUseCase: { execute: vi.fn() },
      getProductByIdUseCase: { execute: vi.fn() },
      createProductUseCase: { execute: vi.fn() },
      publishProductUseCase: { execute: vi.fn() },
      unpublishProductUseCase: { execute: vi.fn() },
      updateProductUseCase: { execute: vi.fn() },
      deleteProductUseCase: { execute: vi.fn() },
      deleteProductImageUseCase: { execute: vi.fn() },
      uploadProductImageUseCase: { execute: vi.fn() },
      listProductImagesUseCase: { execute: vi.fn() },
    };
    controller = new ProductController(useCases);
  });

  describe('list', () => {
    it('uses empty query and forwards use case errors', async () => {
      const error = new Error('boom');
      useCases.listProductsUseCase.execute.mockRejectedValueOnce(error);

      const next = vi.fn();
      await controller.list({}, {}, next);
      expect(next).toHaveBeenCalledWith(error);

      useCases.listProductsUseCase.execute.mockResolvedValueOnce({ data: [] });
      const res = createResponse();
      await controller.list({ query: undefined }, res, vi.fn());
      expect(useCases.listProductsUseCase.execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  describe('listSellerProducts', () => {
    it('returns the seller products with validated query values', async () => {
      const result = { data: [], meta: {} };
      useCases.listSellerProductsUseCase.execute.mockResolvedValue(result);
      const res = createResponse();

      await controller.listSellerProducts(
        sellerReq({ validatedQuery: { page: 2, limit: 10, status: 'published' } }),
        res,
        vi.fn()
      );

      expect(useCases.listSellerProductsUseCase.execute).toHaveBeenCalledWith(SELLER_ID, {
        page: 2,
        limit: 10,
        status: 'published',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('defaults to an empty query object', async () => {
      useCases.listSellerProductsUseCase.execute.mockResolvedValue({ data: [] });

      await controller.listSellerProducts(sellerReq(), createResponse(), vi.fn());

      expect(useCases.listSellerProductsUseCase.execute).toHaveBeenCalledWith(SELLER_ID, {
        page: undefined,
        limit: undefined,
        status: undefined,
      });
    });

    it('forwards a missing dependency error', async () => {
      const without = new ProductController({ listProductsUseCase: useCases.listProductsUseCase });
      const next = vi.fn();

      await without.listSellerProducts(sellerReq(), {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'listSellerProductsUseCase is required',
        })
      );
    });

    it('forwards an UNAUTHORIZED error when the user is missing', async () => {
      const next = vi.fn();

      await controller.listSellerProducts({ user: {} }, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });

    it('forwards a FORBIDDEN error for non-sellers and missing roles', async () => {
      for (const req of [
        { user: { id: SELLER_ID, roles: ['buyer'] } },
        { user: { id: SELLER_ID } },
      ]) {
        const next = vi.fn();
        await controller.listSellerProducts(req, {}, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'FORBIDDEN', statusCode: 403 })
        );
      }
    });

    it('forwards use case errors', async () => {
      const error = new Error('db down');
      useCases.listSellerProductsUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.listSellerProducts(sellerReq(), {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('create', () => {
    it('prefers validated body and the camelCase category id', async () => {
      useCases.createProductUseCase.execute.mockResolvedValue({ data: {} });

      await controller.create(
        sellerReq({
          body: { name: 'Raw' },
          validatedBody: {
            name: 'Validated',
            slug: 'validated',
            description: 'Desc',
            price: 10,
            currency: 'USD',
            stock: 3,
            categoryId: 'cat-1',
            attributes: { color: 'red' },
          },
        }),
        createResponse(),
        vi.fn()
      );

      expect(useCases.createProductUseCase.execute.mock.calls[0][0]).toMatchObject({
        sellerId: SELLER_ID,
        name: 'Validated',
        slug: 'validated',
        description: 'Desc',
        price: 10,
        currency: 'USD',
        stock: 3,
        categoryId: 'cat-1',
        attributes: { color: 'red' },
      });
    });

    it('tolerates a missing body and forwards an UNAUTHORIZED error', async () => {
      useCases.createProductUseCase.execute.mockResolvedValue({ data: {} });
      await controller.create(sellerReq(), createResponse(), vi.fn());
      expect(useCases.createProductUseCase.execute.mock.calls[0][0].categoryId).toBe('');

      const next = vi.fn();
      await controller.create({ user: {} }, {}, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });
  });

  describe('publish and unpublish', () => {
    it('prefers validated params and productId alias', async () => {
      useCases.publishProductUseCase.execute.mockResolvedValue({ data: {} });
      useCases.unpublishProductUseCase.execute.mockResolvedValue({ data: {} });

      await controller.publish(
        sellerReq({ params: { id: 'raw' }, validatedParams: { productId: PRODUCT_ID } }),
        createResponse(),
        vi.fn()
      );
      await controller.unpublish(
        sellerReq({ params: { id: 'raw' }, validatedParams: { productId: PRODUCT_ID } }),
        createResponse(),
        vi.fn()
      );

      expect(useCases.publishProductUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
      });
      expect(useCases.unpublishProductUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
      });
    });

    it('forwards missing dependency and UNAUTHORIZED errors for both methods', async () => {
      const without = new ProductController({ listProductsUseCase: useCases.listProductsUseCase });
      for (const method of ['unpublish', 'publish']) {
        let next = vi.fn();
        // eslint-disable-next-line security/detect-object-injection
        await without[method](sellerReq(), {}, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            message: `${method}ProductUseCase is required`,
          })
        );

        next = vi.fn();
        // eslint-disable-next-line security/detect-object-injection
        await controller[method]({ user: {} }, {}, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
        );
      }
    });

    it('forwards use case errors for unpublish', async () => {
      const error = new Error('boom');
      useCases.unpublishProductUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.unpublish(sellerReq({ params: { id: PRODUCT_ID } }), {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('update, remove and deleteImage', () => {
    it('updates a product with validated params and body', async () => {
      useCases.updateProductUseCase.execute.mockResolvedValue({ data: {} });

      await controller.update(
        sellerReq({
          params: { id: 'raw' },
          validatedParams: { productId: PRODUCT_ID },
          body: { name: 'Raw' },
          validatedBody: { name: 'Validated' },
        }),
        createResponse(),
        vi.fn()
      );

      expect(useCases.updateProductUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
        fields: { name: 'Validated' },
      });
    });

    it('forwards missing dependency and UNAUTHORIZED errors for update, remove and deleteImage', async () => {
      const without = new ProductController({ listProductsUseCase: useCases.listProductsUseCase });
      for (const [method, message] of [
        ['update', 'updateProductUseCase is required'],
        ['remove', 'deleteProductUseCase is required'],
        ['deleteImage', 'deleteProductImageUseCase is required'],
      ]) {
        let next = vi.fn();
        // eslint-disable-next-line security/detect-object-injection
        await without[method](sellerReq(), {}, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, message }));

        next = vi.fn();
        // eslint-disable-next-line security/detect-object-injection
        await controller[method]({ user: {} }, {}, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
        );
      }
    });

    it('removes a product and responds with 204', async () => {
      useCases.deleteProductUseCase.execute.mockResolvedValue(undefined);
      const res = createResponse();

      await controller.remove(
        sellerReq({ params: { id: 'raw' }, validatedParams: { productId: PRODUCT_ID } }),
        res,
        vi.fn()
      );

      expect(useCases.deleteProductUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('deletes an image using a Bearer token and validated params', async () => {
      useCases.deleteProductImageUseCase.execute.mockResolvedValue(undefined);
      const res = createResponse();

      await controller.deleteImage(
        sellerReq({
          params: { id: 'raw', imageId: 'img-1' },
          validatedParams: { productId: PRODUCT_ID, imageId: 'img-2' },
          headers: { authorization: 'Bearer token-1' },
        }),
        res,
        vi.fn()
      );

      expect(useCases.deleteProductImageUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
        imageId: 'img-2',
        sellerId: SELLER_ID,
        accessToken: 'token-1',
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('uses a test token and rejects a missing storage token', async () => {
      useCases.deleteProductImageUseCase.execute.mockResolvedValue(undefined);

      await controller.deleteImage(
        sellerReq({
          params: { id: PRODUCT_ID, imageId: 'img-1' },
          headers: { 'x-test-user-id': SELLER_ID },
        }),
        createResponse(),
        vi.fn()
      );
      expect(useCases.deleteProductImageUseCase.execute.mock.calls[0][0].accessToken).toBe(
        'test-token'
      );

      const next = vi.fn();
      await controller.deleteImage(
        sellerReq({ params: { id: PRODUCT_ID, imageId: 'img-1' }, headers: {} }),
        {},
        next
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });

    it('forwards use case errors for update, remove and deleteImage', async () => {
      const error = new Error('boom');
      useCases.updateProductUseCase.execute.mockRejectedValue(error);
      useCases.deleteProductUseCase.execute.mockRejectedValue(error);
      useCases.deleteProductImageUseCase.execute.mockRejectedValue(error);
      const req = sellerReq({
        params: { id: PRODUCT_ID, imageId: 'img-1' },
        cookies: { access_token: 'token' },
      });

      for (const method of ['update', 'remove', 'deleteImage']) {
        const next = vi.fn();
        // eslint-disable-next-line security/detect-object-injection
        await controller[method](req, {}, next);
        expect(next).toHaveBeenCalledWith(error);
      }
    });
  });

  describe('uploadImage fallbacks', () => {
    it('uses a Bearer token with surrounding whitespace and ignores blank headers', async () => {
      useCases.uploadProductImageUseCase.execute.mockResolvedValue({
        data: {},
        meta: {},
        location: '/v1/products/images/1',
      });
      const res = createResponse();

      await controller.uploadImage(
        sellerReq({
          params: { productId: PRODUCT_ID },
          validatedBody: { altText: 'Alt', position: 2 },
          headers: { authorization: 'Bearer   token-2   ' },
        }),
        res,
        vi.fn()
      );

      expect(useCases.uploadProductImageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'token-2', altText: 'Alt', position: 2 })
      );

      const next = vi.fn();
      await controller.uploadImage(
        sellerReq({ headers: { authorization: 'Basic token' } }),
        {},
        next
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });

    it('uses non-Bearer authorization headers as an absent token', async () => {
      const next = vi.fn();
      await controller.uploadImage(sellerReq({ headers: { authorization: undefined } }), {}, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });

    it('forwards an UNAUTHORIZED error when the user is missing', async () => {
      const next = vi.fn();

      await controller.uploadImage({ headers: {} }, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });

    it('treats a blank Bearer token as an absent session token', async () => {
      const next = vi.fn();

      await controller.uploadImage(
        sellerReq({ headers: { authorization: 'Bearer    ' } }),
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
    });
  });

  describe('listImages and getById fallbacks', () => {
    it('uses validated params for listImages', async () => {
      useCases.listProductImagesUseCase.execute.mockResolvedValue({ data: [] });

      await controller.listImages(
        { params: { id: 'raw' }, validatedParams: { productId: PRODUCT_ID } },
        createResponse(),
        vi.fn()
      );

      expect(useCases.listProductImagesUseCase.execute).toHaveBeenCalledWith({
        productId: PRODUCT_ID,
      });
    });

    it('uses validated params and productId alias for getById', async () => {
      useCases.getProductByIdUseCase.execute.mockResolvedValue({ data: {} });

      await controller.getById(
        {
          params: { id: 'raw' },
          validatedParams: { productId: PRODUCT_ID },
          user: { id: SELLER_ID },
        },
        createResponse(),
        vi.fn()
      );

      expect(useCases.getProductByIdUseCase.execute.mock.calls[0][0]).toMatchObject({
        productId: PRODUCT_ID,
        currentUserId: SELLER_ID,
      });
    });
  });

  it('tolerates a missing params object across product methods', async () => {
    const req = sellerReq({ cookies: { access_token: 'storage-token' } });
    const methods = {
      publish: useCases.publishProductUseCase,
      unpublish: useCases.unpublishProductUseCase,
      update: useCases.updateProductUseCase,
      remove: useCases.deleteProductUseCase,
      uploadImage: useCases.uploadProductImageUseCase,
      listImages: useCases.listProductImagesUseCase,
      deleteImage: useCases.deleteProductImageUseCase,
      getById: useCases.getProductByIdUseCase,
    };

    for (const useCase of Object.values(methods)) {
      useCase.execute.mockResolvedValue({ data: {}, location: '/v1/products/images/1' });
    }

    for (const [method, useCase] of Object.entries(methods)) {
      const next = vi.fn();

      // eslint-disable-next-line security/detect-object-injection
      await controller[method](req, createResponse(), next);

      expect(next).not.toHaveBeenCalled();
      expect(useCase.execute).toHaveBeenCalledOnce();
    }
  });
});
