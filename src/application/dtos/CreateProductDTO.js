export class CreateProductRequestDTO {
  /**
   * @param {Object} input
   * @param {string} input.sellerId          - Injected by the controller from req.user.id
   * @param {string} input.name
   * @param {string} [input.slug]
   * @param {string} [input.description]
   * @param {number} input.price
   * @param {string} [input.currency='USD']
   * @param {number} [input.stock=0]
   * @param {string} input.categoryId        - UUID
   * @param {Object} [input.attributes={}]
   */
  constructor(input = {}) {
    const rawCategoryId = input.categoryId ?? input.category_id;
    const rawAttributes = input.attributes ?? {};

    this.sellerId =
      typeof input.sellerId === 'string' ? input.sellerId.trim() : (input.sellerId ?? '');
    this.name = typeof input.name === 'string' ? input.name.trim() : (input.name ?? '');
    this.slug = typeof input.slug === 'string' ? input.slug.trim() : (input.slug ?? '');
    this.description =
      typeof input.description === 'string'
        ? input.description.trim()
        : (input.description ?? null);
    this.price =
      input.price !== undefined && input.price !== null && input.price !== ''
        ? Number(input.price)
        : 0;
    this.currency =
      typeof input.currency === 'string' && input.currency.trim() !== ''
        ? input.currency.trim().toUpperCase()
        : 'USD';
    this.stock =
      input.stock !== undefined && input.stock !== null && input.stock !== ''
        ? Number(input.stock)
        : 0;
    this.categoryId =
      typeof rawCategoryId === 'string' ? rawCategoryId.trim() : (rawCategoryId ?? '');
    this.attributes =
      rawAttributes && typeof rawAttributes === 'object' && !Array.isArray(rawAttributes)
        ? rawAttributes
        : {};
  }
}
