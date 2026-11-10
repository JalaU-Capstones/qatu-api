/** Order status values used by the public API */
export const ORDER_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
]);

const TERMINAL = Object.freeze(new Set(['delivered', 'cancelled']));

/** Seller transitions per */
const SELLER_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['confirmed']),
  confirmed: Object.freeze(['shipped', 'cancelled']),
  shipped: Object.freeze(['delivered']),
  delivered: Object.freeze([]),
  cancelled: Object.freeze([]),
});

/** Buyer may only cancel while pending. */
const BUYER_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['cancelled']),
  confirmed: Object.freeze([]),
  shipped: Object.freeze([]),
  delivered: Object.freeze([]),
  cancelled: Object.freeze([]),
});

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {'seller'|'buyer'|'admin'} actorRole
 * @returns {boolean}
 */
export function canTransition(fromStatus, toStatus, actorRole) {
  if (!ORDER_STATUSES.includes(fromStatus) || !ORDER_STATUSES.includes(toStatus)) {
    return false;
  }
  if (TERMINAL.has(fromStatus)) {
    return false;
  }
  if (fromStatus === toStatus) {
    return false;
  }

  if (actorRole === 'admin') {
    return ORDER_STATUSES.includes(toStatus);
  }

  const table = actorRole === 'buyer' ? BUYER_TRANSITIONS : SELLER_TRANSITIONS;
  const allowed = table[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {'seller'|'buyer'|'admin'} actorRole
 * @throws {Error}
 */
export function assertTransition(fromStatus, toStatus, actorRole) {
  if (canTransition(fromStatus, toStatus, actorRole)) {
    return;
  }
  const err = new Error('Invalid status transition');
  err.code = 'INVALID_STATUS_TRANSITION';
  err.statusCode = 422;
  throw err;
}

/**
 * Timestamp column to set when entering `toStatus`.
 * @param {string} toStatus
 * @returns {'confirmed_at'|'shipped_at'|'delivered_at'|'cancelled_at'|null}
 */
export function timestampColumnForStatus(toStatus) {
  switch (toStatus) {
    case 'confirmed':
      return 'confirmed_at';
    case 'shipped':
      return 'shipped_at';
    case 'delivered':
      return 'delivered_at';
    case 'cancelled':
      return 'cancelled_at';
    default:
      return null;
  }
}

/**
 * Next statuses a seller UI may offer from the current status.
 * @param {string} fromStatus
 * @returns {string[]}
 */
export function sellerNextStatuses(fromStatus) {
  return [...(SELLER_TRANSITIONS[fromStatus] || [])];
}
