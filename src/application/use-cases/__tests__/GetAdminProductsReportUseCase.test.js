import { describe, expect, it, vi } from 'vitest';

import { GetAdminProductsReportUseCase } from '../GetAdminProductsReportUseCase.js';

describe('GetAdminProductsReportUseCase', () => {
  it('requires a repository', () => {
    expect(() => new GetAdminProductsReportUseCase()).toThrow(/adminReportRepository/);
  });

  it('returns state counts and the top lists', async () => {
    const adminReportRepository = {
      productMetrics: vi.fn().mockResolvedValue({
        total_products: 6,
        published_products: 3,
        draft_products: 1,
        unpublished_products: 1,
        archived_products: 1,
        new_listings: 2,
      }),
      topSellingProducts: vi
        .fn()
        .mockResolvedValue([{ product_id: 'p1', title: 'Manta <script>', units_sold: 9 }]),
      topCategories: vi
        .fn()
        .mockResolvedValue([{ category_id: 'c1', name: 'Textiles', product_count: 4 }]),
      topRatedProducts: vi
        .fn()
        .mockResolvedValue([
          { product_id: 'p1', title: 'Manta <script>', average_rating: 4.5, rating_count: 2 },
        ]),
    };
    const useCase = new GetAdminProductsReportUseCase({ adminReportRepository });

    const result = await useCase.execute({ from: '2026-01-01', to: '2026-03-31' });

    expect(result.data.published_products).toBe(3);
    expect(result.data.draft_products).toBe(1);
    expect(result.data.unpublished_products).toBe(1);
    expect(result.data.top_selling_products).toEqual([
      { product_id: 'p1', title: 'Manta <script>', units_sold: 9 },
    ]);
    expect(result.data.top_categories[0].name).toBe('Textiles');
    expect(result.data.top_rated_products[0].average_rating).toBe(4.5);
  });
});
