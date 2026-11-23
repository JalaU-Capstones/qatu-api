import { describe, expect, it } from 'vitest';
import { applySellerSchema } from '../applySellerSchema.js';

const validApplication = {
  business_name: 'Tienda Andina',
  business_description: 'Artesanías elaboradas por productores locales.',
};

describe('applySellerSchema', () => {
  it('accepts a country code and digits-only phone number as a pair', () => {
    const { error, value } = applySellerSchema.validate({
      ...validApplication,
      country_code: '+591',
      phone_number: '71234567',
      contact_email: 'contacto@tienda.pe',
    });

    expect(error).toBeUndefined();
    expect(value.country_code).toBe('+591');
    expect(value.phone_number).toBe('71234567');
  });

  it('rejects partial or malformed phone details', () => {
    const missingNumber = applySellerSchema.validate({
      ...validApplication,
      country_code: '+591',
    });
    const invalidNumber = applySellerSchema.validate({
      ...validApplication,
      country_code: '+591',
      phone_number: '712 34567',
    });

    expect(missingNumber.error).toBeDefined();
    expect(invalidNumber.error).toBeDefined();
  });

  it('continues accepting the legacy contact_phone field', () => {
    const { error, value } = applySellerSchema.validate({
      ...validApplication,
      contact_phone: '+591 71234567',
    });

    expect(error).toBeUndefined();
    expect(value.contact_phone).toBe('+591 71234567');
  });
});
