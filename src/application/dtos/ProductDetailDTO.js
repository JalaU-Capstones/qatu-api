export class GetProductDetailRequestDTO {
  /**
   * @param {Object} params
   * @param {string} params.productId
   * @param {string} [params.currentUserId]
   */
  constructor({ productId, currentUserId = null } = {}) {
    this.productId = typeof productId === 'string' ? productId.trim() : '';
    this.currentUserId = currentUserId || null;
  }
}

export class ProductDetailDTO {
  /**
   * @param {Object} rawData
   */
  constructor(rawData = {}) {
    this.id = rawData.id;
    this.seller_id = rawData.seller_id;
    this.category_id = rawData.category_id ?? null;
    this.name = rawData.name;
    this.slug = rawData.slug;
    this.description = rawData.description ?? null;
    this.price = rawData.price !== undefined ? Number(rawData.price) : 0;
    this.currency = rawData.currency || 'USD';
    this.stock = rawData.stock !== undefined ? Number(rawData.stock) : 0;
    this.attributes =
      rawData.attributes &&
      typeof rawData.attributes === 'object' &&
      !Array.isArray(rawData.attributes)
        ? rawData.attributes
        : {};
    this.primary_image_path = rawData.primary_image_path ?? null;
    this.images = Array.isArray(rawData.images) ? rawData.images : [];
    this.seller = rawData.seller
      ? {
          id: rawData.seller.id || rawData.seller_id,
          username: rawData.seller.username || null,
          full_name: rawData.seller.full_name || null,
          avatar_path: rawData.seller.avatar_path || null,
        }
      : null;
    this.category = rawData.category
      ? {
          id: rawData.category.id || rawData.category_id,
          name: rawData.category.name || null,
          slug: rawData.category.slug || null,
        }
      : null;
    this.state = rawData.state || 'draft';
    this.average_rating = rawData.average_rating !== undefined ? Number(rawData.average_rating) : 0;
    this.ratings_count = rawData.ratings_count !== undefined ? Number(rawData.ratings_count) : 0;
    this.published_at = rawData.published_at ? new Date(rawData.published_at).toISOString() : null;
    this.created_at = rawData.created_at
      ? new Date(rawData.created_at).toISOString()
      : new Date().toISOString();
    this.updated_at = rawData.updated_at
      ? new Date(rawData.updated_at).toISOString()
      : new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      seller_id: this.seller_id,
      category_id: this.category_id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      price: this.price,
      currency: this.currency,
      stock: this.stock,
      attributes: this.attributes,
      primary_image_path: this.primary_image_path,
      images: this.images,
      seller: this.seller,
      category: this.category,
      state: this.state,
      average_rating: this.average_rating,
      ratings_count: this.ratings_count,
      published_at: this.published_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
