import { describe, expect, it, vi } from 'vitest';

import { GetAdminSalesReportUseCase } from '../GetAdminSalesReportUseCase.js';

function repository(overrides = {}) {
  return {
    salesByCurrency: vi.fn().mockResolvedValue([
      { currency: 'BOB', revenue: 100.5, order_count: 2 },
      { currency: 'USD', revenue: 20, order_count: 1 },
    ]),
    salesByPeriod: vi
      .fn()
      .mockResolvedValue([{ period: '2026-03-01', revenue: 100.5, order_count: 2 }]),
    topProducts: vi
      .fn()
      .mockResolvedValue([{ product_id: 'p1', title: 'Manta', revenue: 80, units_sold: 4 }]),
    topSellers: vi
      .fn()
      .mockResolvedValue([{ seller_id: 's1', display_name: 'Illimani', revenue: 80 }]),
    ...overrides,
  };
}

describe('GetAdminSalesReportUseCase', () => {
  it('requires a repository', () => {
    expect(() => new GetAdminSalesReportUseCase()).toThrow(/adminReportRepository/);
  });

  it('reports the leading currency and keeps every order in the total', async () => {
    const adminReportRepository = repository();
    const useCase = new GetAdminSalesReportUseCase({ adminReportRepository });

    const result = await useCase.execute({
      from: '2026-03-01',
      to: '2026-03-02',
      groupBy: 'day',
    });

    expect(result.data.currency).toBe('BOB');
    expect(result.data.total_revenue).toBe(100.5);
    expect(result.data.total_orders).toBe(3);
    expect(result.data.revenue_by_currency).toHaveLength(2);
    expect(result.data.period_breakdown).toEqual([
      { period: '2026-03-01', revenue: 100.5, order_count: 2 },
      { period: '2026-03-02', revenue: 0, order_count: 0 },
    ]);
    expect(result.data.top_products[0].title).toBe('Manta');
    expect(result.data.top_sellers[0].display_name).toBe('Illimani');
    expect(adminReportRepository.salesByPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'BOB', groupBy: 'day' })
    );
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('returns an empty series when nothing was sold', async () => {
    const adminReportRepository = repository({
      salesByCurrency: vi.fn().mockResolvedValue([]),
    });
    const useCase = new GetAdminSalesReportUseCase({ adminReportRepository });

    const result = await useCase.execute({ from: '2026-03-01', to: '2026-03-01' });

    expect(result.data.currency).toBeNull();
    expect(result.data.total_revenue).toBe(0);
    expect(result.data.total_orders).toBe(0);
    expect(result.data.top_products).toEqual([]);
    expect(result.data.period_breakdown).toEqual([
      { period: '2026-03', revenue: 0, order_count: 0 },
    ]);
    expect(adminReportRepository.salesByPeriod).not.toHaveBeenCalled();
  });

  it('rejects a range that is too long before querying', async () => {
    const adminReportRepository = repository();
    const useCase = new GetAdminSalesReportUseCase({ adminReportRepository });

    await expect(useCase.execute({ from: '2020-01-01', to: '2026-01-01' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(adminReportRepository.salesByCurrency).not.toHaveBeenCalled();
  });
});
