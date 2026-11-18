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
