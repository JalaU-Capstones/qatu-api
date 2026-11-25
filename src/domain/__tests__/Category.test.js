import { describe, it, expect } from 'vitest';
import { Category } from '../entities/Category.js';

describe('Category Entity', () => {
  const base = {
    id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Electronics',
    slug: 'electronics',
  };

  it('should apply defaults for optional fields', () => {
    const category = new Category(base);

    expect(category.description).toBeNull();
    expect(category.parent_id).toBeNull();
    expect(category.position).toBe(0);
    expect(category.is_active).toBe(true);
    expect(category.created_at).toBeInstanceOf(Date);
    expect(category.updated_at).toBeInstanceOf(Date);
  });

  it('should accept snake_case and camelCase inputs', () => {
    const snake = new Category({ ...base, parent_id: 'p1', is_active: false, position: '3' });
    const camel = new Category({ ...base, parentId: 'p1', isActive: false, position: 3 });

    expect(snake.parent_id).toBe('p1');
    expect(camel.parent_id).toBe('p1');
    expect(snake.is_active).toBe(false);
    expect(camel.is_active).toBe(false);
    expect(snake.position).toBe(3);
    expect(camel.position).toBe(3);
  });

  it('should serialize to the OpenAPI Category shape with ISO dates', () => {
    const category = new Category({
      ...base,
      description: 'Gadgets',
      position: 1,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });

    expect(category.toJSON()).toEqual({
      id: base.id,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Gadgets',
      parent_id: null,
      position: 1,
      is_active: true,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
  });

  it('should be constructible without arguments', () => {
    expect(() => new Category()).not.toThrow();
  });

  it('coerces position and defaults a null position to zero', () => {
    expect(new Category({ ...base, position: null }).position).toBe(0);
    expect(new Category({ ...base, position: '7' }).position).toBe(7);
    expect(new Category({ ...base, position: undefined }).position).toBe(0);
  });

  it('treats undefined or null active flags as true and keeps explicit false', () => {
    expect(new Category({ ...base, is_active: null }).is_active).toBe(true);
    expect(new Category({ ...base, isActive: undefined }).is_active).toBe(true);
    expect(new Category({ ...base, is_active: true }).is_active).toBe(true);
    expect(new Category({ ...base, is_active: false }).is_active).toBe(false);
  });

  it('accepts camelCase date aliases and serializes empty optional fields as null', () => {
    const category = new Category({
      ...base,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });

    expect(category.created_at).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(category.updated_at).toEqual(new Date('2026-11-02T00:00:00.000Z'));
    expect(category.toJSON()).toEqual({
      id: base.id,
      name: 'Electronics',
      slug: 'electronics',
      description: null,
      parent_id: null,
      position: 0,
      is_active: true,
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-02T00:00:00.000Z',
    });
  });
});
