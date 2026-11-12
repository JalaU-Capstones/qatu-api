import { describe, expect, it } from 'vitest';
import { createOrderSchema } from '../createOrderSchema.js';

const valid = {
  shipping_address: {
    full_name: 'Aaron Florez',
    phone: '71234567',
    street: '123 Main St',
    city: 'La Paz',
    state: 'La Paz',
    postal_code: '0000',
    country: 'bo',
  },
  payment_method: 'cash_on_delivery',
  notes: 'Leave at reception',
};

const withAddress = (overrides) => ({
  shipping_address: { ...valid.shipping_address, ...overrides },
});

describe('createOrderSchema', () => {
  it('accepts a complete payload and upper-cases the country', () => {
    const { error, value } = createOrderSchema.validate(valid);

    expect(error).toBeUndefined();
    expect(value.shipping_address.country).toBe('BO');
    expect(value.payment_method).toBe('cash_on_delivery');
  });

  it('accepts only the required address fields and defaults the payment method', () => {
    const { error, value } = createOrderSchema.validate({
      shipping_address: {
        full_name: 'Aaron Florez',
        phone: '+591 71234567',
        street: '123 Main St',
        city: 'La Paz',
        country: 'BO',
      },
    });

    expect(error).toBeUndefined();
    expect(value.payment_method).toBe('simulated');
  });

  it('allows empty optional strings', () => {
    const { error } = createOrderSchema.validate({
      ...withAddress({ state: '', postal_code: '' }),
      notes: '',
    });

    expect(error).toBeUndefined();
  });

  it.each([
    ['no body', undefined],
    ['no shipping_address', {}],
    ['no full_name', withAddress({ full_name: undefined })],
    ['full_name too short', withAddress({ full_name: 'A' })],
    ['no phone', withAddress({ phone: undefined })],
    ['phone with letters', withAddress({ phone: 'call me' })],
    ['phone too short', withAddress({ phone: '123' })],
    ['street too short', withAddress({ street: 'ab' })],
    ['city missing', withAddress({ city: undefined })],
    ['country with 3 letters', withAddress({ country: 'BOL' })],
    ['country missing', withAddress({ country: undefined })],
    ['postal code too long', withAddress({ postal_code: '1'.repeat(21) })],
    ['unknown payment method', { ...valid, payment_method: 'bitcoin' }],
    ['notes over 500 chars', { ...valid, notes: 'x'.repeat(501) }],
  ])('rejects %s', (_name, payload) => {
    const { error } = createOrderSchema.validate(payload);

    expect(error).toBeDefined();
  });

  it('does not accept a cart or prices from the client', () => {
    const { value } = createOrderSchema.validate(
      { ...valid, items: [{ product_id: 'x', quantity: 1, unit_price: 0.01 }], total: 0 },
      { stripUnknown: true }
    );

    expect(value).not.toHaveProperty('items');
    expect(value).not.toHaveProperty('total');
  });
});
