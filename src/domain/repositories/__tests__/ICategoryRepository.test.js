/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { ICategoryRepository } from '../ICategoryRepository.js';

describe('ICategoryRepository contract', () => {
  it.each([
    ['findAll', [{ page: 1, limit: 10 }]],
    ['findById', ['category-1']],
    ['findByName', 'Electronics'],
    ['findBySlug', 'electronics'],
    ['create', { name: 'Electronics', slug: 'electronics' }],
    ['update', ['category-1', { name: 'Gadgets' }]],
    ['hasProducts', ['category-1']],
    ['delete', ['category-1']],
  ])('%s throws Method not implemented with the received arguments', async (method, args) => {
    const repository = new ICategoryRepository();

    await expect(repository[method](args)).rejects.toThrow('Method not implemented with');
  });
});
