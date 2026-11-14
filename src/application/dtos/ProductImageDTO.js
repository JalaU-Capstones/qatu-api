import { resolveImageUrl } from '../utils/imageUrl.js';

export class ProductImageDTO {
  constructor(raw = {}) {
    this.id = raw.id;
    this.product_id = raw.product_id;
    this.path = resolveImageUrl(raw.path, 'product-images');
    this.alt_text = raw.alt_text ?? null;
    this.position = raw.position !== undefined ? Number(raw.position) : 0;
    this.created_at = raw.created_at ? new Date(raw.created_at).toISOString() : null;
  }

  toJSON() {
    return {
      id: this.id,
      product_id: this.product_id,
      path: this.path,
      alt_text: this.alt_text,
      position: this.position,
      created_at: this.created_at,
    };
  }
}
