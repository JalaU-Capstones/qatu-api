import { describe, expect, it, vi } from 'vitest';
import { ApplyAsSellerUseCase } from '../ApplyAsSellerUseCase.js';

describe('ApplyAsSellerUseCase', () => {
  const request = {
    profileId: 'buyer-1',
    businessName: 'Tienda Andina',
    businessDescription: 'Artesanías elaboradas por productores locales.',
    contactPhone: '+59171234567',
    contactEmail: 'contacto@tienda.pe',
  };

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
});
