import { QueryTypes } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';

import { AdminReportRepository } from '../AdminReportRepository.js';

function fakeDb(handler) {
  return { query: vi.fn(handler) };
}

describe('AdminReportRepository', () => {
  it('sums only orders that still count as a sale, grouped by currency', async () => {
    const db = fakeDb(async (sql) => {
      expect(sql).toContain("status IN ('pending', 'confirmed', 'shipped', 'delivered')");
      expect(sql).not.toContain('cancelled');
      expect(sql).toContain('GROUP BY o.currency');
      return [{ currency: 'BOB', revenue: '15.50', order_count: '2' }];
    });
    const repository = new AdminReportRepository({ db });

    const rows = await repository.salesByCurrency({ from: '2026-03-01', to: '2026-03-31' });

    expect(rows).toEqual([{ currency: 'BOB', revenue: 15.5, order_count: 2 }]);
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: QueryTypes.SELECT })
    );
  });

  it('binds the period unit instead of concatenating it', async () => {
    const db = fakeDb(async () => [{ period: '2026-03-02', revenue: '1', order_count: '1' }]);
    const repository = new AdminReportRepository({ db });

    await repository.salesByPeriod({
      from: '2026-03-01',
      to: '2026-03-07',
      currency: 'BOB',
      groupBy: 'week',
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('date_trunc(:unit'),
      expect.objectContaining({
        replacements: expect.objectContaining({ unit: 'week', periodFormat: 'YYYY-MM-DD' }),
      })
    );
  });

  it('maps user and product aggregate rows to numbers', async () => {
    const db = fakeDb(async (sql) => {
      if (sql.includes('pending_seller_applications')) {
        return [
          {
            total_users: '4',
            new_registrations: '1',
            buyer_count: '4',
            seller_count: '1',
            active_buyers: '2',
            active_sellers: '1',
            pending_seller_applications: '3',
          },
        ];
      }
      if (sql.includes('unpublished_products')) {
        return [
          {
            total_products: '5',
            published_products: '2',
            draft_products: '1',
            unpublished_products: '1',
            archived_products: '1',
            new_listings: '1',
          },
        ];
      }
      return [];
    });
    const repository = new AdminReportRepository({ db });

    await expect(
      repository.userMetrics({ from: '2026-03-01', to: '2026-03-31' })
    ).resolves.toMatchObject({
      buyer_count: 4,
      seller_count: 1,
      pending_seller_applications: 3,
    });

    await expect(
      repository.productMetrics({ from: '2026-03-01', to: '2026-03-31' })
    ).resolves.toMatchObject({
      published_products: 2,
      draft_products: 1,
      unpublished_products: 1,
    });
  });

  it('asks for units across currencies when ranking top-selling products', async () => {
    const db = fakeDb(async (sql, options) => {
      expect(sql).not.toContain('o.currency = :currency');
      expect(options.replacements.limit).toBe(5);
      return [{ product_id: 'p1', title: 'Manta', units_sold: '7' }];
    });
    const repository = new AdminReportRepository({ db });

    await expect(
      repository.topSellingProducts({ from: '2026-03-01', to: '2026-03-31', limit: 5 })
    ).resolves.toEqual([{ product_id: 'p1', title: 'Manta', units_sold: 7 }]);
  });
});

const RANGE = { from: '2026-03-01', to: '2026-03-31' };

describe('AdminReportRepository — remaining branches', () => {
  it('uses the shared sequelize instance by default', () => {
    expect(new AdminReportRepository().db).toBeDefined();
  });

  it('treats a non-array query result as an empty list', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const repository = new AdminReportRepository({ db });

    await expect(repository.salesByCurrency(RANGE)).resolves.toEqual([]);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), {
      replacements: RANGE,
      type: QueryTypes.SELECT,
    });
  });

  it('normalizes null and invalid numeric aggregates to zero', async () => {
    const db = {
      query: vi.fn().mockResolvedValue([{ currency: 'USD', revenue: null, order_count: 'n/a' }]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.salesByCurrency(RANGE)).resolves.toEqual([
      { currency: 'USD', revenue: 0, order_count: 0 },
    ]);
  });

  it('uses the month format only for monthly periods', async () => {
    const db = { query: vi.fn().mockResolvedValue([]) };
    const repository = new AdminReportRepository({ db });

    await repository.salesByPeriod({ ...RANGE, currency: 'USD', groupBy: 'month' });
    expect(db.query.mock.calls[0][1].replacements).toMatchObject({
      unit: 'month',
      periodFormat: 'YYYY-MM',
      currency: 'USD',
    });

    await repository.salesByPeriod({ ...RANGE, currency: 'BOB', groupBy: 'day' });
    expect(db.query.mock.calls[1][1].replacements.periodFormat).toBe('YYYY-MM-DD');
  });

  it('maps top products with the default limit', async () => {
    const db = {
      query: vi.fn().mockResolvedValue([
        { product_id: 'p1', title: 'Manta', revenue: '20.5', units_sold: '3' },
        { product_id: 'p2', title: 'Taza', revenue: null, units_sold: null },
      ]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.topProducts({ ...RANGE, currency: 'USD' })).resolves.toEqual([
      { product_id: 'p1', title: 'Manta', revenue: 20.5, units_sold: 3 },
      { product_id: 'p2', title: 'Taza', revenue: 0, units_sold: 0 },
    ]);
    expect(db.query.mock.calls[0][1].replacements).toEqual({ ...RANGE, currency: 'USD', limit: 5 });
  });

  it('zeroes invalid period and seller aggregates', async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ period: '2026-03', revenue: 'x', order_count: 'y' }])
        .mockResolvedValueOnce([{ seller_id: 's1', display_name: 'Ana', revenue: 'bad' }]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.salesByPeriod({ ...RANGE, currency: 'USD' })).resolves.toEqual([
      { period: '2026-03', revenue: 0, order_count: 0 },
    ]);
    await expect(repository.topSellers({ ...RANGE, currency: 'USD' })).resolves.toEqual([
      { seller_id: 's1', display_name: 'Ana', revenue: 0 },
    ]);
  });

  it('maps top sellers with an explicit limit', async () => {
    const db = {
      query: vi.fn().mockResolvedValue([{ seller_id: 's1', display_name: 'Ana', revenue: '9' }]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.topSellers({ ...RANGE, currency: 'BOB', limit: 10 })).resolves.toEqual([
      { seller_id: 's1', display_name: 'Ana', revenue: 9 },
    ]);
    expect(db.query.mock.calls[0][0]).toContain('JOIN public.profiles pr');
    expect(db.query.mock.calls[0][1].replacements.limit).toBe(10);
  });

  it('maps top-selling products with invalid numbers', async () => {
    const db = {
      query: vi.fn().mockResolvedValue([{ product_id: 'p1', title: 'Manta', units_sold: 'bad' }]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.topSellingProducts({ ...RANGE, limit: 2 })).resolves.toEqual([
      { product_id: 'p1', title: 'Manta', units_sold: 0 },
    ]);
  });

  it('returns zeroed metrics when aggregates return no rows', async () => {
    const db = { query: vi.fn().mockResolvedValue([]) };
    const repository = new AdminReportRepository({ db });

    await expect(repository.userMetrics(RANGE)).resolves.toEqual({
      total_users: 0,
      new_registrations: 0,
      buyer_count: 0,
      seller_count: 0,
      active_buyers: 0,
      active_sellers: 0,
      pending_seller_applications: 0,
    });
    await expect(repository.productMetrics(RANGE)).resolves.toEqual({
      total_products: 0,
      published_products: 0,
      draft_products: 0,
      unpublished_products: 0,
      archived_products: 0,
      new_listings: 0,
    });
  });

  it('maps top categories and top rated products with default limits', async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ category_id: 'c1', name: 'Casa', product_count: '4' }])
        .mockResolvedValueOnce([
          { product_id: 'p1', title: 'Manta', average_rating: '4.80', rating_count: '12' },
        ]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.topCategories()).resolves.toEqual([
      { category_id: 'c1', name: 'Casa', product_count: 4 },
    ]);
    await expect(repository.topRatedProducts()).resolves.toEqual([
      { product_id: 'p1', title: 'Manta', average_rating: 4.8, rating_count: 12 },
    ]);
    expect(db.query.mock.calls[0][0]).toContain('GROUP BY c.id, c.name');
    expect(db.query.mock.calls[1][0]).toContain('ratings_count > 0');
    expect(db.query.mock.calls[0][1].replacements).toEqual({ limit: 5 });
    expect(db.query.mock.calls[1][1].replacements).toEqual({ limit: 5 });
  });

  it('normalizes invalid ranking numbers to zero', async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ category_id: 'c1', name: 'Casa', product_count: null }])
        .mockResolvedValueOnce([
          { product_id: 'p1', title: 'Manta', average_rating: null, rating_count: 'x' },
        ]),
    };
    const repository = new AdminReportRepository({ db });

    await expect(repository.topCategories({ limit: 3 })).resolves.toEqual([
      { category_id: 'c1', name: 'Casa', product_count: 0 },
    ]);
    await expect(repository.topRatedProducts({ limit: 7 })).resolves.toEqual([
      { product_id: 'p1', title: 'Manta', average_rating: 0, rating_count: 0 },
    ]);
  });
});
