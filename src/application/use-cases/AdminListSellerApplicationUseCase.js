export class AdminListSellerApplicationsUseCase {
  constructor({ sellerApplicationRepository }) {
    if (!sellerApplicationRepository) {
      throw new Error('sellerApplicationRepository is required');
    }
    this.sellerApplicationRepository = sellerApplicationRepository;
  }

  async execute({ status = null, page = 1, limit = 20 } = {}) {
    const result = await this.sellerApplicationRepository.findAllPaginated({
      status,
      page,
      limit,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

    return {
      data: result.items.map((item) => item.toJSON()),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
