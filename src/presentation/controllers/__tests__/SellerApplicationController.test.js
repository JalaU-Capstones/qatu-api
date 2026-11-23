import { describe, expect, it, vi } from 'vitest';
import { SellerApplicationController } from '../SellerApplicationController.js';

describe('SellerApplicationController', () => {
  it('combines country code and phone number for the existing application record', async () => {
    const execute = vi.fn().mockResolvedValue({ data: { id: 'application-1' } });
    const controller = new SellerApplicationController({
      applyAsSellerUseCase: { execute },
      getMySellerApplicationUseCase: { execute: vi.fn() },
    });
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await controller.apply(
      {
        user: { id: 'buyer-1' },
        validatedBody: {
          business_name: 'Tienda Andina',
          business_description: 'Artesanías elaboradas por productores locales.',
          country_code: '+591',
          phone_number: '71234567',
          contact_email: 'contacto@tienda.pe',
        },
      },
      response,
      next
    );

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ contactPhone: '+59171234567' }));
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
