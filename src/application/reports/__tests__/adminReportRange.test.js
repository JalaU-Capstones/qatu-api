import { describe, expect, it } from 'vitest';

import {
  assertDateRange,
  assertGroupBy,
  fillPeriodBuckets,
  pickChartCurrency,
  reportValidationError,
} from '../adminReportRange.js';

describe('adminReportRange', () => {
  it('rejects an impossible calendar date', () => {
    expect(() => assertDateRange({ from: '2026-02-31', to: '2026-03-01' })).toThrow(/real dates/);
    try {
      assertDateRange({ from: '2026-02-31', to: '2026-03-01' });
    } catch (error) {
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    }
  });

  it('rejects an inverted range and a span longer than a year', () => {
    expect(() => assertDateRange({ from: '2026-03-02', to: '2026-03-01' })).toThrow(/on or before/);
    expect(() => assertDateRange({ from: '2024-01-01', to: '2026-01-01' })).toThrow(
      /cannot exceed/
    );
  });

  it('accepts a full leap-year span', () => {
    const range = assertDateRange({ from: '2024-01-01', to: '2024-12-31' });
    expect(range.from).toBe('2024-01-01');
    expect(range.to).toBe('2024-12-31');
  });

  it('rejects an unknown group_by', () => {
    expect(() => assertGroupBy('quarter')).toThrow(/group_by/);
  });

  it('picks the currency with the highest revenue', () => {
    expect(
      pickChartCurrency([
        { currency: 'USD', revenue: 10, order_count: 5 },
        { currency: 'BOB', revenue: 40, order_count: 1 },
      ])
    ).toBe('BOB');
  });

  it('breaks currency ties by order count and then by code', () => {
    expect(
      pickChartCurrency([
        { currency: 'USD', revenue: 10, order_count: 2 },
        { currency: 'BOB', revenue: 10, order_count: 4 },
      ])
    ).toBe('BOB');

    expect(
      pickChartCurrency([
        { currency: 'USD', revenue: 10, order_count: 2 },
        { currency: 'BOB', revenue: 10, order_count: 2 },
      ])
    ).toBe('BOB');
  });

  it('fills missing days and aligns weeks to Monday', () => {
    const days = fillPeriodBuckets(
      new Date(Date.UTC(2026, 2, 1)),
      new Date(Date.UTC(2026, 2, 3)),
      'day',
      [{ period: '2026-03-02', revenue: '12.5', order_count: '1' }]
    );
    expect(days).toEqual([
      { period: '2026-03-01', revenue: 0, order_count: 0 },
      { period: '2026-03-02', revenue: 12.5, order_count: 1 },
      { period: '2026-03-03', revenue: 0, order_count: 0 },
    ]);

    const weeks = fillPeriodBuckets(
      new Date(Date.UTC(2026, 2, 4)),
      new Date(Date.UTC(2026, 2, 4)),
      'week',
      []
    );
    expect(weeks.map((bucket) => bucket.period)).toEqual(['2026-03-02']);
  });

  it('builds a validation error with the API status', () => {
    const error = reportValidationError('nope');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});
