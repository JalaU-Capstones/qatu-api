import { describe, expect, it } from 'vitest';
import { ROLE_DEFINITIONS, ROLES } from '../constants/roles.js';

describe('roles constants', () => {
  it('exposes the three canonical role names as a frozen object', () => {
    expect(ROLES).toEqual({ BUYER: 'buyer', SELLER: 'seller', ADMIN: 'admin' });
    expect(Object.isFrozen(ROLES)).toBe(true);
  });

  it('exposes a frozen definition per role with stable ids and descriptions', () => {
    expect(Object.isFrozen(ROLE_DEFINITIONS)).toBe(true);
    expect(Object.keys(ROLE_DEFINITIONS)).toEqual(['buyer', 'seller', 'admin']);
    expect(ROLE_DEFINITIONS[ROLES.BUYER]).toEqual({
      id: 1,
      name: 'buyer',
      description: 'Default role for all registered users. Can browse products and make purchases.',
    });
    expect(ROLE_DEFINITIONS[ROLES.SELLER]).toEqual({
      id: 2,
      name: 'seller',
      description: 'Approved merchant who can list and sell products on the platform.',
    });
    expect(ROLE_DEFINITIONS[ROLES.ADMIN]).toEqual({
      id: 3,
      name: 'admin',
      description: 'Platform administrator with full management and moderation access.',
    });
  });
});
