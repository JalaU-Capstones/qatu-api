import { describe, expect, it } from 'vitest';
import { CreateOrderRequestDTO } from '../CreateOrderDTO.js';

const address = {
  full_name: ' Aaron Florez ',
  phone: '71234567',
  street: ' 123 Main St ',
  city: 'La Paz',
  state: 'La Paz',
  postal_code: '0000',
  country: 'bo',
};

describe('CreateOrderRequestDTO', () => {
  it('normalizes and freezes the request', () => {
    const dto = new CreateOrderRequestDTO({
      buyerId: ' buyer-1 ',
      shippingAddress: address,
      notes: '  Leave at reception  ',
    });

    expect(dto.buyerId).toBe('buyer-1');
    expect(dto.shippingAddress).toEqual({
      full_name: 'Aaron Florez',
      phone: '71234567',
      street: '123 Main St',
      city: 'La Paz',
      state: 'La Paz',
      postal_code: '0000',
      country: 'BO',
    });
    expect(dto.notes).toBe('Leave at reception');
    expect(Object.isFrozen(dto)).toBe(true);
  });

  it('turns blank optional fields into null', () => {
    const dto = new CreateOrderRequestDTO({
      buyerId: 'b',
      shippingAddress: { ...address, state: '  ', postal_code: '' },
      notes: '',
    });

    expect(dto.shippingAddress.state).toBeNull();
    expect(dto.shippingAddress.postal_code).toBeNull();
    expect(dto.notes).toBeNull();
  });

  it('requires the authenticated buyer id', () => {
    expect(() => new CreateOrderRequestDTO({ shippingAddress: address })).toThrow(
      'buyerId is missing'
    );
  });

  it.each(['full_name', 'phone', 'street', 'city', 'country'])(
    'rejects a missing shipping_address.%s',
    (field) => {
      expect(
        () =>
          new CreateOrderRequestDTO({
            buyerId: 'b',
            shippingAddress: { ...address, [field]: '' },
          })
      ).toThrow(`shipping_address.${field} is invalid`);
    }
  );

  it('rejects a phone with letters', () => {
    expect(
      () =>
        new CreateOrderRequestDTO({
          buyerId: 'b',
          shippingAddress: { ...address, phone: 'call me' },
        })
    ).toThrow('shipping_address.phone is invalid');
  });

  it('rejects a missing shipping address', () => {
    expect(() => new CreateOrderRequestDTO({ buyerId: 'b' })).toThrow(
      'shipping_address is invalid'
    );
  });

  it('defaults the payment method to simulated and accepts cash on delivery', () => {
    const base = { buyerId: 'b', shippingAddress: address };

    expect(new CreateOrderRequestDTO(base).paymentMethod).toBe('simulated');
    expect(
      new CreateOrderRequestDTO({ ...base, paymentMethod: 'cash_on_delivery' }).paymentMethod
    ).toBe('cash_on_delivery');
  });

  it('rejects an unknown payment method', () => {
    expect(
      () =>
        new CreateOrderRequestDTO({
          buyerId: 'b',
          shippingAddress: address,
          paymentMethod: 'bitcoin',
        })
    ).toThrow('payment_method is invalid');
  });

  it('rejects notes longer than 500 characters', () => {
    expect(
      () =>
        new CreateOrderRequestDTO({
          buyerId: 'b',
          shippingAddress: address,
          notes: 'x'.repeat(501),
        })
    ).toThrow('notes must be at most 500 characters');
  });

  it('throws errors that the error handler maps to 400 VALIDATION_ERROR', () => {
    try {
      new CreateOrderRequestDTO({});
    } catch (error) {
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    }
    expect.assertions(2);
  });
});
