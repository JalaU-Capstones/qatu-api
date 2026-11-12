export class Product {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} [params.seller_id]
   * @param {string} [params.sellerId]
   * @param {string|null} [params.category_id]
   * @param {string|null} [params.categoryId]
   * @param {string} params.name
   * @param {string} params.slug
   * @param {string|null} [params.description]
   * @param {number|string} params.price
   * @param {string} [params.currency='USD']
   * @param {number} [params.stock=0]
   * @param {Object} [params.attributes={}]
   * @param {string|null} [params.primary_image_path]
   * @param {string|null} [params.primaryImagePath]
   * @param {string} [params.state='draft']
   * @param {number} [params.average_rating=0]
   * @param {number} [params.averageRating]
   * @param {number} [params.ratings_count=0]
   * @param {number} [params.ratingsCount]
   * @param {Date|string|null} [params.published_at]
   * @param {Date|string|null} [params.publishedAt]
   * @param {Date|string} [params.created_at]
   * @param {Date|string} [params.createdAt]
   * @param {Date|string} [params.updated_at]
   * @param {Date|string} [params.updatedAt]
   */
  constructor({
    id,
    seller_id,
    sellerId,
    category_id = null,
    categoryId,
    name,
    slug,
    description = null,
    price,
    currency = 'USD',
    stock = 0,
    attributes = {},
    primary_image_path = null,
    primaryImagePath,
    state = 'draft',
    average_rating,
    averageRating,
    ratings_count,
    ratingsCount,
    published_at = null,
    publishedAt,
    created_at,
    createdAt,
    updated_at,
    updatedAt,
  } = {}) {
    this.id = id;
    this.seller_id = seller_id !== undefined ? seller_id : sellerId;
    this.category_id =
      category_id !== undefined && category_id !== null ? category_id : (categoryId ?? null);
    this.name = name;
    this.slug = slug;
    this.description = description ?? null;
    this.price = price !== undefined && price !== null ? Number(price) : 0;
    this.currency = currency || 'USD';
    this.stock = stock !== undefined && stock !== null ? Number(stock) : 0;
    this.attributes =
      attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? attributes : {};
    this.primary_image_path =
      primary_image_path !== undefined && primary_image_path !== null
        ? primary_image_path
        : (primaryImagePath ?? null);
    this.state = state || 'draft';

    const rawRating = average_rating !== undefined ? average_rating : (averageRating ?? 0);
    this.average_rating = Number(rawRating);

    const rawRatingsCount = ratings_count !== undefined ? ratings_count : (ratingsCount ?? 0);
    this.ratings_count = Number(rawRatingsCount);

    const rawPublished = published_at !== undefined ? published_at : publishedAt;
    this.published_at = rawPublished ? new Date(rawPublished) : null;

    const rawCreated = created_at !== undefined ? created_at : createdAt;
    this.created_at = rawCreated ? new Date(rawCreated) : new Date();

    const rawUpdated = updated_at !== undefined ? updated_at : updatedAt;
    this.updated_at = rawUpdated ? new Date(rawUpdated) : new Date();
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
      published_at: this.published_at ? this.published_at.toISOString() : null,
      created_at: this.created_at ? this.created_at.toISOString() : null,
      updated_at: this.updated_at ? this.updated_at.toISOString() : null,
    };
  }
}
