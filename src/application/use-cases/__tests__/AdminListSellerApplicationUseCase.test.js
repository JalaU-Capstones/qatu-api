import { describe, expect, it, vi } from 'vitest';
import { SellerApplication } from '../../../domain/entities/SellerApplication.js';
import { AdminListSellerApplicationsUseCase } from '../AdminListSellerApplicationUseCase.js';

const application = (id, status = 'pending') =>
  new SellerApplication({
    id,
    profileId: `profile-${id}`,
    businessName: 'Talleres Wara',
    businessDescription: 'Artisan textiles from Bolivia',
    status,
  });

describe('AdminListSellerApplicationsUseCase', () => {
  it('requires a sellerApplicationRepository', () => {
    expect(() => new AdminListSellerApplicationsUseCase({})).toThrow(
      'sellerApplicationRepository is required'
    );
    expect(
      () => new AdminListSellerApplicationsUseCase({ sellerApplicationRepository: null })
    ).toThrow('sellerApplicationRepository is required');
  });

  it('uses defaults and always reports at least one page', async () => {
    const repository = {
      findAllPaginated: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    };
    const useCase = new AdminListSellerApplicationsUseCase({
      sellerApplicationRepository: repository,
    });

    const result = await useCase.execute();

    expect(repository.findAllPaginated).toHaveBeenCalledWith({
      status: null,
      page: 1,
      limit: 20,
    });
    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 0, totalPages: 1 });
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('maps entities and computes totalPages from the repository response', async () => {
    const repository = {
      findAllPaginated: vi.fn().mockResolvedValue({
        items: [application('a', 'pending'), application('b', 'approved')],
        total: 7,
        page: 2,
        limit: 2,
      }),
    };
    const useCase = new AdminListSellerApplicationsUseCase({
      sellerApplicationRepository: repository,
    });

    const result = await useCase.execute({ status: 'approved', page: 2, limit: 2 });

    expect(repository.findAllPaginated).toHaveBeenCalledWith({
      status: 'approved',
      page: 2,
      limit: 2,
    });
    expect(result.data.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.data[0]).toHaveProperty('business_name', 'Talleres Wara');
    expect(result.meta.totalPages).toBe(4);
  });

  it('propagates repository errors', async () => {
    const repository = { findAllPaginated: vi.fn().mockRejectedValue(new Error('db down')) };
    const useCase = new AdminListSellerApplicationsUseCase({
      sellerApplicationRepository: repository,
    });

    await expect(useCase.execute()).rejects.toThrow('db down');
  });
});
