export class ListCategoriesRequestDTO {
  /**
   * @param {Object} [params]
   * @param {number|string} [params.page=1]
   * @param {number|string} [params.limit=20]
   */
  constructor({ page = 1, limit = 20 } = {}) {
    this.page = page !== undefined && page !== null && page !== '' ? Number(page) : 1;
    this.limit = limit !== undefined && limit !== null && limit !== '' ? Number(limit) : 20;
  }

  toRepositoryParams() {
    return {
      page: this.page,
      limit: this.limit,
    };
  }
}

export class CategoryListItemDTO {
  /**
   * @param {import('../../domain/entities/Category.js').Category} category
   */
  constructor(category) {
    if (!category) {
      throw new Error('Category entity is required');
    }
    const json = typeof category.toJSON === 'function' ? category.toJSON() : category;
    Object.assign(this, json);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description ?? null,
      parent_id: this.parent_id ?? null,
      position: this.position,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
