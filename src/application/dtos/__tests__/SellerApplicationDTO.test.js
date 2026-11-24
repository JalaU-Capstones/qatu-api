import { describe, expect, it } from 'vitest';
import { SellerApplication } from '../../../domain/entities/SellerApplication.js';
import { ApplyAsSellerRequestDTO, SellerApplicationResponseDTO } from '../SellerApplicationDTO.js';

describe('SellerApplicationDTO', () => {
  describe('ApplyAsSellerRequestDTO', () => {
    it('maps snake_case fields to the camelCase entity shape', () => {
      const dto = new ApplyAsSellerRequestDTO({
        profileId: 'profile-1',
        business_name: 'Talleres Wara',
        business_description: 'Artisan textiles from Bolivia',
        contact_phone: '+591 70000000',
        contact_email: 'seller@example.com',
      });

      expect(dto).toEqual({
        profileId: 'profile-1',
        businessName: 'Talleres Wara',
        businessDescription: 'Artisan textiles from Bolivia',
        contactPhone: '+591 70000000',
        contactEmail: 'seller@example.com',
      });
    });

    it('defaults contact details to null when they are omitted', () => {
      const dto = new ApplyAsSellerRequestDTO({
        profileId: 'profile-2',
        business_name: 'Talleres Wara',
        business_description: 'Artisan textiles from Bolivia',
      });

      expect(dto.contactPhone).toBeNull();
      expect(dto.contactEmail).toBeNull();
    });
  });

  describe('SellerApplicationResponseDTO', () => {
    it('wraps the entity JSON with an ISO timestamp', () => {
      const application = new SellerApplication({
        id: 'app-1',
        profileId: 'profile-1',
        businessName: 'Talleres Wara',
        businessDescription: 'Artisan textiles from Bolivia',
        status: 'pending',
      });

      const response = SellerApplicationResponseDTO.fromEntity(application);

      expect(response.data).toEqual(application.toJSON());
      expect(response.meta.timestamp).toEqual(expect.any(String));
      expect(new Date(response.meta.timestamp).toISOString()).toBe(response.meta.timestamp);
    });
  });
});
