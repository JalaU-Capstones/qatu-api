/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { IProductRepository } from '../IProductRepository.js';

describe('IProductRepository contract', () => {
  it.each([
    ['findById', ['product-1']],
    ['findAll', [{ page: 1, limit: 20 }]],
    ['findAll', [{ page: 1, limit: 20, filters: { search: 'chair' }, sort: { field: 'price' } }]],
    ['listBySeller', ['seller-1']],
    ['listBySeller', ['seller-1', { page: 2, limit: 10, status: 'draft' }]],
    ['create', [{ name: 'Chair' }]],
    ['create', [{ name: 'Chair' }, { transaction: {} }]],
    ['publish', [{ productId: 'product-1', sellerId: 'seller-1' }]],
    ['publish', [{ productId: 'product-1', sellerId: 'seller-1' }, { transaction: {} }]],
    ['unpublish', [{ productId: 'product-1', sellerId: 'seller-1' }]],
    ['update', [{ productId: 'product-1', sellerId: 'seller-1', fields: { name: 'Chair' } }]],
    ['softDelete', [{ productId: 'product-1', sellerId: 'seller-1' }]],
    ['addImage', [{ productId: 'product-1', path: 'img.png', position: 1 }]],
    ['listImages', ['product-1']],
    ['listImages', ['product-1', { transaction: {} }]],
    ['countImages', ['product-1']],
    ['setPrimaryImageIfNull', [{ productId: 'product-1', path: 'img.png' }]],
    ['findImageById', ['image-1']],
    ['deleteImage', ['image-1']],
    ['recomputePrimaryImage', ['product-1']],
    ['findByIdWithDetails', ['product-1']],
    ['decrementStockIfAvailable', [{ productId: 'product-1', quantity: 2 }]],
    ['decrementStockIfAvailable', [{ productId: 'product-1', quantity: 2 }, { transaction: {} }]],
  ])('%s throws Method not implemented', async (method, args) => {
    const repository = new IProductRepository();

    await expect(repository[method](...args)).rejects.toThrow(/Method not implemented/);
  });
});
