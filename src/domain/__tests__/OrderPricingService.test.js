import { describe, expect, it } from 'vitest';
import { MixedCurrencyError } from '../errors/CheckoutErrors.js';
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  OrderPricingService,
} from '../services/OrderPricingService.js';

const line = (overrides = {}) => ({
  productId: 'p-1',
  unitPrice: 10,
  quantity: 1,
  currency: 'USD',
  ...overrides,
});

describe('OrderPricingService', () => {
  const service = new OrderPricingService();

  it('mirrors the storefront cart rule (free from 50, flat 4.99 below)', () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(50);
    expect(FLAT_SHIPPING_RATE).toBe(4.99);
  });

  it('adds the flat shipping fee below the free-shipping threshold', () => {
    const result = service.calculate([line({ unitPrice: 20, quantity: 2 })]);

    expect(result).toEqual({
      currency: 'USD',
      subtotal: 40,
      shippingCost: 4.99,
      tax: 0,
      total: 44.99,
    });
  });

  it('waives shipping when the subtotal reaches exactly the threshold', () => {
    const result = service.calculate([line({ unitPrice: 25, quantity: 2 })]);

    expect(result.subtotal).toBe(50);
    expect(result.shippingCost).toBe(0);
    expect(result.total).toBe(50);
  });

  it('charges shipping one cent below the threshold', () => {
    const result = service.calculate([line({ unitPrice: 49.99 })]);

    expect(result.shippingCost).toBe(4.99);
    expect(result.total).toBe(54.98);
  });

  it('sums several lines without floating point drift', () => {
    const result = service.calculate([
      line({ productId: 'a', unitPrice: 0.1, quantity: 3 }),
      line({ productId: 'b', unitPrice: 0.2, quantity: 3 }),
    ]);

    expect(result.subtotal).toBe(0.9);
    expect(result.total).toBe(5.89);
  });

  it('keeps total = subtotal + shipping + tax (database CHECK constraint)', () => {
    const taxed = new OrderPricingService({ taxRate: 0.13 });
    const result = taxed.calculate([line({ unitPrice: 33.33, quantity: 3 })]);

    expect(result.tax).toBe(13);
    expect(Math.round((result.subtotal + result.shippingCost + result.tax) * 100)).toBe(
      Math.round(result.total * 100)
    );
  });

  it('rejects lines with different currencies', () => {
    expect(() => service.calculate([line(), line({ productId: 'p-2', currency: 'EUR' })])).toThrow(
      MixedCurrencyError
    );
  });

  it('rejects an empty list', () => {
    expect(() => service.calculate([])).toThrow(RangeError);
  });

  it('rejects invalid quantities and prices', () => {
    expect(() => service.calculate([line({ quantity: 0 })])).toThrow(RangeError);
    expect(() => service.calculate([line({ quantity: 1.5 })])).toThrow(RangeError);
    expect(() => service.calculate([line({ unitPrice: -1 })])).toThrow(RangeError);
    expect(() => service.calculate([line({ unitPrice: 'abc' })])).toThrow(RangeError);
  });
});
