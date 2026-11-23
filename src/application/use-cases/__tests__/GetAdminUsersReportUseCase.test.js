import { describe, expect, it, vi } from 'vitest';

import { GetAdminUsersReportUseCase } from '../GetAdminUsersReportUseCase.js';

describe('GetAdminUsersReportUseCase', () => {
  it('requires a repository', () => {
    expect(() => new GetAdminUsersReportUseCase()).toThrow(/adminReportRepository/);
  });

  it('returns role totals and the pending queue', async () => {
    const adminReportRepository = {
      userMetrics: vi.fn().mockResolvedValue({
        total_users: 10,
        new_registrations: 2,
        buyer_count: 10,
        seller_count: 3,
        active_buyers: 4,
        active_sellers: 1,
        pending_seller_applications: 2,
      }),
    };
    const useCase = new GetAdminUsersReportUseCase({ adminReportRepository });

    const result = await useCase.execute({ from: '2026-03-01', to: '2026-03-31' });

    expect(result.data).toEqual({
      total_users: 10,
      new_registrations: 2,
      buyer_count: 10,
      seller_count: 3,
      active_buyers: 4,
      active_sellers: 1,
      pending_seller_applications: 2,
    });
    expect(adminReportRepository.userMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-03-01', to: '2026-03-31' })
    );
  });
});
