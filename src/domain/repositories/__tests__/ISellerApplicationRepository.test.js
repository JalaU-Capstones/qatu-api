/* eslint-disable security/detect-object-injection -- table-driven contract tests dispatch methods by name */
import { describe, expect, it } from 'vitest';
import { ISellerApplicationRepository } from '../ISellerApplicationRepository.js';

describe('ISellerApplicationRepository contract', () => {
  it.each([
    ['create', [{ profileId: 'profile-1' }]],
    ['create', [{ profileId: 'profile-1' }, { transaction: {} }]],
    ['findPendingByProfileId', ['profile-1']],
    ['findPendingByProfileId', ['profile-1', { transaction: {} }]],
    ['findLatestByProfileId', ['profile-1']],
    ['findById', ['application-1', {}]],
    ['findById', ['application-1', { transaction: {} }]],
    ['findAllPaginated', [{}]],
    ['findAllPaginated', [{ status: 'pending', page: 2, limit: 10 }]],
    ['review', [{ id: 'application-1', status: 'approved', reviewedBy: 'admin-1' }, {}]],
    [
      'review',
      [
        {
          id: 'application-1',
          status: 'rejected',
          reviewedBy: 'admin-1',
          rejectionReason: 'Invalid data',
        },
        { transaction: {} },
      ],
    ],
  ])('%s reports that it must be implemented', async (method, args) => {
    const repository = new ISellerApplicationRepository();

    await expect(repository[method](...args)).rejects.toThrow(/must be implemented/);
  });
});
