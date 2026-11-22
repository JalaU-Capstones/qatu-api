import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteProductUseCase } from '../DeleteProductUseCase.js';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SELLER_ID = '660e8400-e29b-41d4-a716-446655440001';

const product = (overrides = {}) => ({
  id: PRODUCT_ID,
  seller_id: SELLER_ID,
  name: 'Test Product',
  state: 'draft',
  ...overrides,
});

describe('DeleteProductUseCase', () => {
  let productRepository;
  let useCase;

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      softDelete: vi.fn(),
    };
    useCase = new DeleteProductUseCase({ productRepository });
  });

  it('1. rejects a missing productId with 400 VALIDATION_ERROR', async () => {
    await expect(useCase.execute({ sellerId: SELLER_ID })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(productRepository.softDelete).not.toHaveBeenCalled();
  });

  it('2. rejects an invalid UUID productId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ productId: 'invalid-uuid', sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId must be a valid UUID',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(productRepository.softDelete).not.toHaveBeenCalled();
  });

  it('3. rejects a missing sellerId with 400 VALIDATION_ERROR', async () => {
    await expect(useCase.execute({ productId: PRODUCT_ID })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'sellerId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(productRepository.softDelete).not.toHaveBeenCalled();
  });

  it('4. returns 404 PRODUCT_NOT_FOUND when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
    expect(productRepository.softDelete).not.toHaveBeenCalled();
  });

  it('5. returns 403 FORBIDDEN when accessed by another seller and softDelete is not called', async () => {
    productRepository.findById.mockResolvedValue(product({ seller_id: 'other-seller' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
    expect(productRepository.softDelete).not.toHaveBeenCalled();
  });

  it('6. soft-deletes a draft product on happy path and returns meta timestamp', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'draft' }));
    productRepository.softDelete.mockResolvedValue({ id: PRODUCT_ID, deleted_at: new Date() });

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result).toEqual({
      meta: { timestamp: expect.any(String) },
    });
    expect(productRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(productRepository.softDelete).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
    });
  });

  it('7. soft-deletes a published product on happy path', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published' }));
    productRepository.softDelete.mockResolvedValue({ id: PRODUCT_ID, deleted_at: new Date() });

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result).toEqual({
      meta: { timestamp: expect.any(String) },
    });
    expect(productRepository.softDelete).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
    });
  });

  it('8. soft-deletes an archived product on happy path (proves NO archived guard)', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'archived' }));
    productRepository.softDelete.mockResolvedValue({ id: PRODUCT_ID, deleted_at: new Date() });

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result).toEqual({
      meta: { timestamp: expect.any(String) },
    });
    expect(productRepository.softDelete).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
    });
  });

  it('9. returns 404 PRODUCT_NOT_FOUND if softDelete returns null (concurrency race)', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published' }));
    productRepository.softDelete.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });
});
