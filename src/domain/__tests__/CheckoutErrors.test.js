import { describe, expect, it } from 'vitest';
import {
  CannotBuyOwnProductError,
  CheckoutError,
  EmptyCartError,
  InsufficientStockError,
  MixedCurrencyError,
  ProductUnavailableError,
} from '../errors/CheckoutErrors.js';

describe('CheckoutErrors', () => {
  it('builds the base CheckoutError with a default empty detail list', () => {
    const error = new CheckoutError('Something failed', { code: 'SOMETHING_FAILED' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CheckoutError');
    expect(error.message).toBe('Something failed');
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('SOMETHING_FAILED');
    expect(error.details).toEqual([]);
  });

  it('accepts explicit details and defaults the options object', () => {
    const details = [{ field: 'items.1', message: 'Bad item' }];
    const withDetails = new CheckoutError('Failed', { code: 'FAILED', details });
    const withoutOptions = new CheckoutError('Failed');

    expect(withDetails.details).toBe(details);
    expect(withoutOptions.code).toBeUndefined();
    expect(withoutOptions.details).toEqual([]);
  });

  it('builds CannotBuyOwnProductError with and without a product name', () => {
    const named = new CannotBuyOwnProductError('Wool Poncho');
    const unnamed = new CannotBuyOwnProductError();

    expect(named).toBeInstanceOf(CheckoutError);
    expect(named.message).toBe('You cannot purchase your own product: Wool Poncho');
    expect(named.code).toBe('CANNOT_BUY_OWN_PRODUCT');
    expect(named.statusCode).toBe(422);
    expect(named.name).toBe('CannotBuyOwnProductError');
    expect(unnamed.message).toBe('You cannot purchase your own product');
  });

  it('builds EmptyCartError and MixedCurrencyError', () => {
    const emptyCart = new EmptyCartError();
    const mixedCurrency = new MixedCurrencyError();

    expect(emptyCart).toBeInstanceOf(CheckoutError);
    expect(emptyCart.message).toBe('Your cart is empty');
    expect(emptyCart.code).toBe('EMPTY_CART');
    expect(emptyCart.name).toBe('EmptyCartError');
    expect(mixedCurrency.message).toBe('All items in an order must use the same currency');
    expect(mixedCurrency.code).toBe('MIXED_CURRENCIES');
    expect(mixedCurrency.name).toBe('MixedCurrencyError');
  });

  it('builds InsufficientStockError with field-level details', () => {
    const error = new InsufficientStockError({ productId: 'product-1', productName: 'Poncho' });

    expect(error.message).toBe('Insufficient stock for Poncho');
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.details).toEqual([
      { field: 'items.product-1', message: 'Insufficient stock for Poncho' },
    ]);
  });

  it('builds ProductUnavailableError with field-level details', () => {
    const error = new ProductUnavailableError({ productId: 'product-2', productName: 'Chair' });

    expect(error.message).toBe('Chair is no longer available');
    expect(error.code).toBe('PRODUCT_UNAVAILABLE');
    expect(error.details).toEqual([
      { field: 'items.product-2', message: 'Chair is no longer available' },
    ]);
  });
});
