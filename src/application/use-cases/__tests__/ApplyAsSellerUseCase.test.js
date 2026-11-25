import { describe, expect, it, vi } from 'vitest';
import { SELLER_APPLICATION_STATUS } from '../../../domain/entities/SellerApplication.js';
import { ApplyAsSellerUseCase } from '../ApplyAsSellerUseCase.js';

const request = {
  profileId: 'profile-1',
  businessName: 'Talleres Wara',
  businessDescription: 'Artisan textiles from Bolivia',
  contactPhone: '+591 70000000',
  contactEmail: 'seller@example.com',
};

const buildUseCase = ({ roleNames = ['buyer'], pending = null, created } = {}) => {
  const sellerApplicationRepository = {
    findPendingByProfileId: vi.fn().mockResolvedValue(pending),
    create: vi.fn().mockImplementation(async (entity) => created ?? entity),
  };
  const profileRepository = { getRoleNames: vi.fn().mockResolvedValue(roleNames) };

  return {
    sellerApplicationRepository,
    profileRepository,
    useCase: new ApplyAsSellerUseCase({
      sellerApplicationRepository,
      profileRepository,
    }),
  };
};

describe('ApplyAsSellerUseCase', () => {
  it('requires sellerApplicationRepository and profileRepository', () => {
    expect(() => new ApplyAsSellerUseCase({})).toThrow('sellerApplicationRepository is required');
    expect(() => new ApplyAsSellerUseCase({ sellerApplicationRepository: {} })).toThrow(
      'profileRepository is required'
    );
  });

  it('creates a pending application and returns the response envelope', async () => {
    const { sellerApplicationRepository, profileRepository, useCase } = buildUseCase();

    const response = await useCase.execute(request);

    expect(profileRepository.getRoleNames).toHaveBeenCalledWith('profile-1');
    expect(sellerApplicationRepository.findPendingByProfileId).toHaveBeenCalledWith('profile-1');
    expect(sellerApplicationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-1',
        businessName: 'Talleres Wara',
        businessDescription: 'Artisan textiles from Bolivia',
        contactPhone: '+591 70000000',
        contactEmail: 'seller@example.com',
        status: SELLER_APPLICATION_STATUS.PENDING,
      })
    );
    expect(response.data).toMatchObject({
      profile_id: 'profile-1',
      business_name: 'Talleres Wara',
      business_description: 'Artisan textiles from Bolivia',
      contact_phone: '+591 70000000',
      contact_email: 'seller@example.com',
      status: 'pending',
    });
    expect(response.meta.timestamp).toEqual(expect.any(String));
  });

  it('rejects administrators before checking or creating applications', async () => {
    const sellerApplicationRepository = {
      findPendingByProfileId: vi.fn(),
      create: vi.fn(),
    };
    const profileRepository = {
      getRoleNames: vi.fn().mockResolvedValue(['admin', 'seller']),
    };
    const useCase = new ApplyAsSellerUseCase({ sellerApplicationRepository, profileRepository });

    await expect(useCase.execute(request)).rejects.toMatchObject({
      message: 'Administrators cannot submit seller applications',
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    expect(sellerApplicationRepository.findPendingByProfileId).not.toHaveBeenCalled();
    expect(sellerApplicationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects users that already hold the seller role', async () => {
    const { sellerApplicationRepository, useCase } = buildUseCase({
      roleNames: ['buyer', 'seller'],
    });

    await expect(useCase.execute(request)).rejects.toMatchObject({
      message: 'You are already a seller',
      code: 'ALREADY_SELLER',
      statusCode: 409,
    });
    expect(sellerApplicationRepository.findPendingByProfileId).not.toHaveBeenCalled();
    expect(sellerApplicationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects users with a pending application', async () => {
    const { sellerApplicationRepository, useCase } = buildUseCase({ pending: { id: 'app-1' } });

    await expect(useCase.execute(request)).rejects.toMatchObject({
      message: 'You already have a pending application',
      code: 'DUPLICATE_APPLICATION',
      statusCode: 409,
    });
    expect(sellerApplicationRepository.create).not.toHaveBeenCalled();
  });

  it('allows regular authenticated users to create seller applications', async () => {
    const sellerApplicationRepository = {
      findPendingByProfileId: vi.fn().mockResolvedValue(null),
      create: vi.fn((application) => Promise.resolve(application)),
    };
    const profileRepository = {
      getRoleNames: vi.fn().mockResolvedValue(['buyer']),
    };
    const useCase = new ApplyAsSellerUseCase({ sellerApplicationRepository, profileRepository });

    const result = await useCase.execute(request);

    expect(sellerApplicationRepository.create).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({
      profile_id: request.profileId,
      business_name: request.businessName,
      business_description: request.businessDescription,
      contact_phone: request.contactPhone,
      contact_email: request.contactEmail,
      status: 'pending',
    });
  });

  it('propagates repository errors', async () => {
    const { sellerApplicationRepository, useCase } = buildUseCase();
    sellerApplicationRepository.create.mockRejectedValueOnce(new Error('db down'));

    await expect(useCase.execute(request)).rejects.toThrow('db down');
  });
});
