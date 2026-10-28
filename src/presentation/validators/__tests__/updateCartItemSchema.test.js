import { describe, expect, it } from 'vitest';
import { updateCartItemSchema } from '../updateCartItemSchema.js';

describe('updateCartItemSchema', () => {
  it('Scenario 1: Valid quantity -> passes validation', () => {
    const { error, value } = updateCartItemSchema.validate({ quantity: 5 });
    expect(error).toBeUndefined();
    expect(value.quantity).toBe(5);
  });

  it('Scenario 2: Quantity equals 0 -> passes validation', () => {
    const { error, value } = updateCartItemSchema.validate({ quantity: 0 });
    expect(error).toBeUndefined();
    expect(value.quantity).toBe(0);
  });

  it('Scenario 3: Missing quantity -> returns validation error', () => {
    const { error } = updateCartItemSchema.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toBe('quantity is required');
  });

  it('Scenario 4: Negative quantity -> returns validation error', () => {
    const { error } = updateCartItemSchema.validate({ quantity: -1 });
    expect(error).toBeDefined();
    expect(error.details[0].message).toBe('quantity cannot be negative');
  });

  it('Scenario 5: Non-integer quantity -> returns validation error', () => {
    const { error } = updateCartItemSchema.validate({ quantity: 2.5 });
    expect(error).toBeDefined();
    expect(error.details[0].message).toBe('quantity must be an integer');
  });
});
