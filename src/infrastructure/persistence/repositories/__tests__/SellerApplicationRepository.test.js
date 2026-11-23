import { describe, expect, it } from 'vitest';
import { SellerApplicationRepository } from '../SellerApplicationRepository.js';

describe('SellerApplicationRepository', () => {
  it('maps contact fields from database rows into the serialized application', () => {
    const repository = new SellerApplicationRepository({ db: {} });

    const application = repository.toDomain({
      id: 'application-1',
      profile_id: 'buyer-1',
      business_name: 'Tienda Andina',
      business_description: 'Artesanías elaboradas por productores locales.',
      contact_phone: '+59171234567',
      contact_email: 'contacto@tienda.pe',
      status: 'pending',
      created_at: '2026-11-23T12:00:00.000Z',
      updated_at: '2026-11-23T12:00:00.000Z',
    });

    expect(application.toJSON()).toMatchObject({
      contact_phone: '+59171234567',
      contact_email: 'contacto@tienda.pe',
    });
  });
});
