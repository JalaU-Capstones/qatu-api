export class Category {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.name
   * @param {string} params.slug
   * @param {string|null} [params.description]
   * @param {string|null} [params.parent_id]
   * @param {string|null} [params.parentId]
   * @param {number} [params.position=0]
   * @param {boolean} [params.is_active=true]
   * @param {boolean} [params.isActive]
   * @param {Date|string} [params.created_at]
   * @param {Date|string} [params.createdAt]
   * @param {Date|string} [params.updated_at]
   * @param {Date|string} [params.updatedAt]
   */
  constructor({
    id,
    name,
    slug,
    description = null,
    parent_id,
    parentId,
    position = 0,
    is_active,
    isActive,
    created_at,
    createdAt,
    updated_at,
    updatedAt,
  } = {}) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.description = description ?? null;
    this.parent_id = parent_id !== undefined ? parent_id : (parentId ?? null);
    this.position = position !== undefined && position !== null ? Number(position) : 0;

    const rawActive = is_active !== undefined ? is_active : isActive;
    this.is_active = rawActive === undefined || rawActive === null ? true : Boolean(rawActive);

    const rawCreated = created_at !== undefined ? created_at : createdAt;
    this.created_at = rawCreated ? new Date(rawCreated) : new Date();

    const rawUpdated = updated_at !== undefined ? updated_at : updatedAt;
    this.updated_at = rawUpdated ? new Date(rawUpdated) : new Date();
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
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
    };
  }
}
