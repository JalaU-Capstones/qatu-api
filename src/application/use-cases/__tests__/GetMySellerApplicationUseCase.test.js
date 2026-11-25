import { describe, expect, it, vi } from 'vitest';
import { SellerApplication } from '../../../domain/entities/SellerApplication.js';
import { GetMySellerApplicationUseCase } from '../GetMySellerApplicationUseCase.js';

const application = new SellerApplication({
  id: 'app-1',
  profileId: 'profile-1',
  businessName: 'Talleres Wara',
  businessDescription: 'Artisan textiles from Bolivia',
  status: 'pending',
});

describe('GetMySellerApplicationUseCase', () => {
  it('requires a sellerApplicationRepository', () => {
    expect(() => new GetMySellerApplicationUseCase({})).toThrow(
      'sellerApplicationRepository is required'
    );
    expect(() => new GetMySellerApplicationUseCase({ sellerApplicationRepository: null })).toThrow(
      'sellerApplicationRepository is required'
    );
  });

  it('returns the latest application wrapped in a response envelope', async () => {
    const repository = { findLatestByProfileId: vi.fn().mockResolvedValue(application) };
    const useCase = new GetMySellerApplicationUseCase({ sellerApplicationRepository: repository });

    const result = await useCase.execute({ profileId: 'profile-1' });

    expect(repository.findLatestByProfileId).toHaveBeenCalledWith('profile-1');
    expect(result.data).toEqual(application.toJSON());
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('throws a 404 NOT_FOUND when there is no application', async () => {
    const repository = { findLatestByProfileId: vi.fn().mockResolvedValue(null) };
    const useCase = new GetMySellerApplicationUseCase({ sellerApplicationRepository: repository });

    await expect(useCase.execute({ profileId: 'profile-2' })).rejects.toMatchObject({
      message: 'Seller application not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
