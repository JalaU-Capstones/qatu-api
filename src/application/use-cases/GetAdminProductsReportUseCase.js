import { assertDateRange, roundMoney, toCount } from '../reports/adminReportRange.js';

export class GetAdminProductsReportUseCase {
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
   * @param {{ from?: string, to?: string }} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute({ from, to } = {}) {
    const range = assertDateRange({ from, to });
    const [metrics, topSelling, topCategories, topRated] = await Promise.all([
      this.adminReportRepository.productMetrics(range),
      this.adminReportRepository.topSellingProducts({ ...range, limit: 5 }),
      this.adminReportRepository.topCategories({ limit: 5 }),
      this.adminReportRepository.topRatedProducts({ limit: 5 }),
    ]);

    return {
      data: {
        total_products: toCount(metrics.total_products),
        published_products: toCount(metrics.published_products),
        draft_products: toCount(metrics.draft_products),
        unpublished_products: toCount(metrics.unpublished_products),
        archived_products: toCount(metrics.archived_products),
        new_listings: toCount(metrics.new_listings),
        top_selling_products: topSelling.map((row) => ({
          product_id: row.product_id,
          title: row.title,
          units_sold: toCount(row.units_sold),
        })),
        top_categories: topCategories.map((row) => ({
          category_id: row.category_id,
          name: row.name,
          product_count: toCount(row.product_count),
        })),
        top_rated_products: topRated.map((row) => ({
          product_id: row.product_id,
          title: row.title,
          average_rating: roundMoney(row.average_rating),
          rating_count: toCount(row.rating_count),
        })),
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
