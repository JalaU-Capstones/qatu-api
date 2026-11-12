export const ROLES = Object.freeze({
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin',
});

export const ROLE_DEFINITIONS = Object.freeze({
  [ROLES.BUYER]: {
    id: 1,
    name: ROLES.BUYER,
    description: 'Default role for all registered users. Can browse products and make purchases.',
  },
  [ROLES.SELLER]: {
    id: 2,
    name: ROLES.SELLER,
    description: 'Approved merchant who can list and sell products on the platform.',
  },
  [ROLES.ADMIN]: {
    id: 3,
    name: ROLES.ADMIN,
    description: 'Platform administrator with full management and moderation access.',
  },
});
