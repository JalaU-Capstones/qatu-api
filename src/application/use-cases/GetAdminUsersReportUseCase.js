import { assertDateRange, toCount } from '../reports/adminReportRange.js';

export class GetAdminUsersReportUseCase {
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
    const metrics = await this.adminReportRepository.userMetrics(range);

    return {
      data: {
        total_users: toCount(metrics.total_users),
        new_registrations: toCount(metrics.new_registrations),
        buyer_count: toCount(metrics.buyer_count),
        seller_count: toCount(metrics.seller_count),
        active_buyers: toCount(metrics.active_buyers),
        active_sellers: toCount(metrics.active_sellers),
        pending_seller_applications: toCount(metrics.pending_seller_applications),
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
