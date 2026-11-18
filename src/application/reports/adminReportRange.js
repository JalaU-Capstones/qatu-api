const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_BY = new Set(['day', 'week', 'month']);

/** Inclusive calendar span the report queries will accept. */
export const MAX_REPORT_RANGE_DAYS = 366;

/**
 * @param {string} message
 * @returns {Error}
 */
export function reportValidationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION_ERROR';
  err.statusCode = 400;
  return err;
}

/**
 * Parses a YYYY-MM-DD string as a UTC calendar date.
 * Rejects impossible dates such as 2026-02-31.
 *
 * @param {string} value
 * @returns {Date|null}
 */
export function parseUtcDate(value) {
  if (!DATE_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * @param {{ from?: string, to?: string }} input
 * @returns {{ from: string, to: string, fromDate: Date, toDate: Date }}
 */
export function assertDateRange({ from, to } = {}) {
  const fromDate = parseUtcDate(from);
  const toDate = parseUtcDate(to);
  if (!fromDate || !toDate) {
    throw reportValidationError('from and to must be real dates in YYYY-MM-DD format.');
  }
  if (fromDate.getTime() > toDate.getTime()) {
    throw reportValidationError('from must be on or before to.');
  }

  const inclusiveDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  if (inclusiveDays > MAX_REPORT_RANGE_DAYS) {
    throw reportValidationError(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days.`);
  }

  return { from, to, fromDate, toDate };
}

/**
 * @param {string} [groupBy='month']
 * @returns {'day'|'week'|'month'}
 */
export function assertGroupBy(groupBy = 'month') {
  if (!GROUP_BY.has(groupBy)) {
    throw reportValidationError('group_by must be day, week, or month.');
  }
  return groupBy;
}

/**
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function toCount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.trunc(amount);
}

/**
 * Picks the currency the headline revenue and the period chart use.
 * Highest revenue wins. Ties break on order count, then currency code.
 *
 * @param {Array<{ currency: string, revenue: number, order_count: number }>} rows
 * @returns {string|null}
 */
export function pickChartCurrency(rows) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((left, right) => {
    if (right.revenue !== left.revenue) return right.revenue - left.revenue;
    if (right.order_count !== left.order_count) return right.order_count - left.order_count;
    return String(left.currency).localeCompare(String(right.currency));
  });
  return sorted[0].currency;
}

/**
 * Aligns a UTC date to the start of its day, ISO week (Monday), or month.
 *
 * @param {Date} date
 * @param {'day'|'week'|'month'} groupBy
 * @returns {Date}
 */
export function alignPeriod(date, groupBy) {
  if (groupBy === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  if (groupBy === 'week') {
    const aligned = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const weekday = aligned.getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    aligned.setUTCDate(aligned.getUTCDate() + mondayOffset);
    return aligned;
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * @param {Date} date
 * @param {'day'|'week'|'month'} groupBy
 * @returns {string}
 */
export function formatPeriod(date, groupBy) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (groupBy === 'month') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

/**
 * @param {Date} date
 * @param {'day'|'week'|'month'} groupBy
 * @returns {Date}
 */
function addPeriod(date, groupBy) {
  const next = new Date(date.getTime());
  if (groupBy === 'month') {
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
  next.setUTCDate(next.getUTCDate() + (groupBy === 'week' ? 7 : 1));
  return next;
}

/**
 * Builds a continuous series so the chart has a bar for every period in the
 * range, including periods with no orders.
 *
 * @param {Date} fromDate
 * @param {Date} toDate
 * @param {'day'|'week'|'month'} groupBy
 * @param {Array<{ period: string, revenue?: number|string, order_count?: number|string }>} rows
 * @returns {Array<{ period: string, revenue: number, order_count: number }>}
 */
export function fillPeriodBuckets(fromDate, toDate, groupBy, rows) {
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  const buckets = [];
  let cursor = alignPeriod(fromDate, groupBy);
  const end = alignPeriod(toDate, groupBy);
  let guard = 0;

  while (cursor.getTime() <= end.getTime() && guard < MAX_REPORT_RANGE_DAYS + 1) {
    const period = formatPeriod(cursor, groupBy);
    const row = byPeriod.get(period);
    buckets.push({
      period,
      revenue: roundMoney(row?.revenue),
      order_count: toCount(row?.order_count),
    });
    cursor = addPeriod(cursor, groupBy);
    guard += 1;
  }

  return buckets;
}
