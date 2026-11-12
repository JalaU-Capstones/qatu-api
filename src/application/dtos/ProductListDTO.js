export class ListProductsRequestDTO {
  /**
   * @param {Object} [params]
   * @param {number|string} [params.page=1]
   * @param {number|string} [params.limit=20]
   * @param {string} [params.search]
   * @param {string} [params.category_id]
   * @param {string} [params.categoryId]
   * @param {number|string} [params.min_price]
   * @param {number|string} [params.minPrice]
   * @param {number|string} [params.max_price]
   * @param {number|string} [params.maxPrice]
   * @param {string} [params.seller_id]
   * @param {string} [params.sellerId]
   * @param {string} [params.sort_by='created_at']
   * @param {string} [params.sortBy]
   * @param {'asc'|'desc'|'ASC'|'DESC'} [params.sort_order='desc']
   * @param {'asc'|'desc'|'ASC'|'DESC'} [params.sortOrder]
   */
  constructor({
    page = 1,
    limit = 20,
    search,
    category_id,
    categoryId,
    min_price,
    minPrice,
    max_price,
    maxPrice,
    seller_id,
    sellerId,
    sort_by = 'created_at',
    sortBy,
    sort_order = 'desc',
    sortOrder,
  } = {}) {
    this.page = page !== undefined && page !== null && page !== '' ? Number(page) : 1;
    this.limit = limit !== undefined && limit !== null && limit !== '' ? Number(limit) : 20;

    this.search = typeof search === 'string' ? search.trim() : (search ?? undefined);

    this.category_id = category_id !== undefined ? category_id : (categoryId ?? undefined);

    const rawMinPrice = min_price !== undefined ? min_price : minPrice;
    this.min_price =
      rawMinPrice !== undefined && rawMinPrice !== null && rawMinPrice !== ''
        ? Number(rawMinPrice)
        : undefined;

    const rawMaxPrice = max_price !== undefined ? max_price : maxPrice;
    this.max_price =
      rawMaxPrice !== undefined && rawMaxPrice !== null && rawMaxPrice !== ''
        ? Number(rawMaxPrice)
        : undefined;

    this.seller_id = seller_id !== undefined ? seller_id : (sellerId ?? undefined);

    const rawSortBy = sortBy !== undefined ? sortBy : sort_by;
    this.sort_by = rawSortBy || 'created_at';

    const rawSortOrder = sortOrder !== undefined ? sortOrder : sort_order;
    this.sort_order = rawSortOrder ? String(rawSortOrder).toLowerCase() : 'desc';
  }

  toRepositoryParams() {
    return {
      page: this.page,
      limit: this.limit,
      filters: {
        search: this.search,
        categoryId: this.category_id,
        minPrice: this.min_price,
        maxPrice: this.max_price,
        sellerId: this.seller_id,
      },
      sort: {
        field: this.sort_by,
        order: this.sort_order,
      },
    };
  }
}

export class ProductListItemDTO {
  /**
   * @param {import('../../domain/entities/Product.js').Product} product
   */
  constructor(product) {
    if (!product) {
      throw new Error('Product entity is required');
    }
    const json = typeof product.toJSON === 'function' ? product.toJSON() : product;
    Object.assign(this, json);
    this.attributes = this.attributes ?? {};
  }

  toJSON() {
    return {
      id: this.id,
      seller_id: this.seller_id,
      category_id: this.category_id ?? null,
      name: this.name,
      slug: this.slug,
      description: this.description ?? null,
      price: this.price,
      currency: this.currency,
      stock: this.stock,
      attributes: this.attributes ?? {},
      primary_image_path: this.primary_image_path ?? null,
      state: this.state,
      average_rating: this.average_rating,
      ratings_count: this.ratings_count,
      published_at: this.published_at ?? null,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
