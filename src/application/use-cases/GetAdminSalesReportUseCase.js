import {
  assertDateRange,
  assertGroupBy,
  fillPeriodBuckets,
  pickChartCurrency,
  roundMoney,
  toCount,
} from '../reports/adminReportRange.js';

export class GetAdminSalesReportUseCase {
  /**
   * @param {Object} options
   * @param {import('../../infrastructure/persistence/repositories/AdminReportRepository.js').AdminReportRepository} options.adminReportRepository
   */
  constructor({ adminReportRepository } = {}) {
    if (!adminReportRepository) {
      throw new Error('adminReportRepository is required');
    }
    this.adminReportRepository = adminReportRepository;
  }

  /**
   * @param {{ from?: string, to?: string, groupBy?: string }} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute({ from, to, groupBy = 'month' } = {}) {
    const range = assertDateRange({ from, to });
    const unit = assertGroupBy(groupBy);
    const byCurrency = await this.adminReportRepository.salesByCurrency(range);
    const revenueByCurrency = byCurrency.map((row) => ({
      currency: row.currency,
      revenue: roundMoney(row.revenue),
      order_count: toCount(row.order_count),
    }));
    const currency = pickChartCurrency(revenueByCurrency);
    const chartRow = revenueByCurrency.find((row) => row.currency === currency);
    const totalOrders = revenueByCurrency.reduce((sum, row) => sum + row.order_count, 0);

    let periodRows = [];
    let topProducts = [];
    let topSellers = [];
    if (currency) {
      [periodRows, topProducts, topSellers] = await Promise.all([
        this.adminReportRepository.salesByPeriod({ ...range, currency, groupBy: unit }),
        this.adminReportRepository.topProducts({ ...range, currency, limit: 5 }),
        this.adminReportRepository.topSellers({ ...range, currency, limit: 5 }),
      ]);
    }

    return {
      data: {
        currency,
        total_revenue: chartRow ? chartRow.revenue : 0,
        total_orders: totalOrders,
        revenue_by_currency: revenueByCurrency,
        period_breakdown: fillPeriodBuckets(range.fromDate, range.toDate, unit, periodRows),
        top_products: topProducts.map((row) => ({
          product_id: row.product_id,
          title: row.title,
          revenue: roundMoney(row.revenue),
          units_sold: toCount(row.units_sold),
        })),
        top_sellers: topSellers.map((row) => ({
          seller_id: row.seller_id,
          display_name: row.display_name,
          revenue: roundMoney(row.revenue),
        })),
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
