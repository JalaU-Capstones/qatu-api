import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  sellerNextStatuses,
  timestampColumnForStatus,
} from '../services/OrderStatusTransitionService.js';

describe('OrderStatusTransitionService', () => {
  it('allows seller happy path', () => {
    expect(canTransition('pending', 'confirmed', 'seller')).toBe(true);
    expect(canTransition('confirmed', 'shipped', 'seller')).toBe(true);
    expect(canTransition('shipped', 'delivered', 'seller')).toBe(true);
    expect(canTransition('confirmed', 'cancelled', 'seller')).toBe(true);
  });

  it('rejects invalid seller transitions including terminal reverse', () => {
    expect(canTransition('delivered', 'pending', 'seller')).toBe(false);
    expect(canTransition('cancelled', 'confirmed', 'seller')).toBe(false);
    expect(canTransition('pending', 'shipped', 'seller')).toBe(false);
    expect(canTransition('shipped', 'cancelled', 'seller')).toBe(false);
  });

  it('allows buyer cancel only from pending', () => {
    expect(canTransition('pending', 'cancelled', 'buyer')).toBe(true);
    expect(canTransition('confirmed', 'cancelled', 'buyer')).toBe(false);
  });

  it('allows admin any non-terminal transition', () => {
    expect(canTransition('pending', 'delivered', 'admin')).toBe(true);
    expect(canTransition('delivered', 'shipped', 'admin')).toBe(false);
  });

  it('assertTransition throws 422 with AC message', () => {
    expect(() => assertTransition('delivered', 'pending', 'seller')).toThrow(
      expect.objectContaining({
        message: 'Invalid status transition',
        code: 'INVALID_STATUS_TRANSITION',
        statusCode: 422,
      })
    );
  });

  it('maps timestamp columns and seller next statuses', () => {
    expect(timestampColumnForStatus('confirmed')).toBe('confirmed_at');
    expect(timestampColumnForStatus('shipped')).toBe('shipped_at');
    expect(sellerNextStatuses('confirmed')).toEqual(['shipped', 'cancelled']);
    expect(sellerNextStatuses('delivered')).toEqual([]);
  });
});
