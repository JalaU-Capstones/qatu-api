import { QueryTypes } from 'sequelize';

import { sequelize } from '../../config/sequelize.js';

/**
 * Orders that still count as a sale. Cancelled and refunded orders are left
 * out so they do not inflate revenue or the period chart.
 */
const COUNTED_ORDER_STATUSES = `('pending', 'confirmed', 'shipped', 'delivered')`;

const ORDER_RANGE = `
  o.created_at >= (:from)::date
  AND o.created_at < ((:to)::date + interval '1 day')
  AND o.status IN ${COUNTED_ORDER_STATUSES}
`;

/**
 * Read-only aggregates for the admin reports. The API connects as the database
 * owner, so these queries see every row. RLS still applies to browser clients.
 */
export class AdminReportRepository {
  /**
   * @param {Object} [options]
   * @param {{ query: Function }} [options.db]
   */
  constructor({ db = sequelize } = {}) {
    this.db = db;
  }

  /**
   * @param {string} sql
   * @param {Object} replacements
   * @returns {Promise<Array<Object>>}
   * @private
   */
  async _select(sql, replacements) {
    const rows = await this.db.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * @param {{ from: string, to: string }} range
   * @returns {Promise<Array<{ currency: string, revenue: number, order_count: number }>>}
   */
  async salesByCurrency({ from, to }) {
    const rows = await this._select(
      `
      SELECT
        o.currency,
        COALESCE(SUM(o.total), 0)::float AS revenue,
        COUNT(*)::int AS order_count
      FROM public.orders o
      WHERE ${ORDER_RANGE}
      GROUP BY o.currency
      ORDER BY revenue DESC, o.currency ASC
      `,
      { from, to }
    );

    return rows.map((row) => ({
      currency: row.currency,
      revenue: Number(row.revenue) || 0,
      order_count: Number(row.order_count) || 0,
    }));
  }

  /**
   * Period buckets for a single currency. `unit` is day, week, or month.
   *
   * @param {{ from: string, to: string, currency: string, groupBy: 'day'|'week'|'month' }} query
   * @returns {Promise<Array<{ period: string, revenue: number, order_count: number }>>}
   */
  async salesByPeriod({ from, to, currency, groupBy }) {
    const periodFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const rows = await this._select(
      `
      SELECT
        to_char(
          date_trunc(:unit, o.created_at AT TIME ZONE 'UTC'),
          :periodFormat
        ) AS period,
        COALESCE(SUM(o.total), 0)::float AS revenue,
        COUNT(*)::int AS order_count
      FROM public.orders o
      WHERE ${ORDER_RANGE}
        AND o.currency = :currency
      GROUP BY 1
      ORDER BY 1
      `,
      { from, to, currency, unit: groupBy, periodFormat }
    );

    return rows.map((row) => ({
      period: row.period,
      revenue: Number(row.revenue) || 0,
      order_count: Number(row.order_count) || 0,
    }));
  }

  /**
   * @param {{ from: string, to: string, currency: string, limit?: number }} query
   * @returns {Promise<Array<{ product_id: string, title: string, revenue: number, units_sold: number }>>}
   */
  async topProducts({ from, to, currency, limit = 5 }) {
    const rows = await this._select(
      `
      SELECT
        oi.product_id,
        MAX(oi.product_name) AS title,
        COALESCE(SUM(oi.subtotal), 0)::float AS revenue,
        COALESCE(SUM(oi.quantity), 0)::int AS units_sold
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE ${ORDER_RANGE}
        AND o.currency = :currency
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
      ORDER BY units_sold DESC, revenue DESC
      LIMIT :limit
      `,
      { from, to, currency, limit }
    );

    return rows.map((row) => ({
      product_id: row.product_id,
      title: row.title,
      revenue: Number(row.revenue) || 0,
      units_sold: Number(row.units_sold) || 0,
    }));
  }

  /**
   * Seller revenue is the sum of their line subtotals, not the order total.
   *
   * @param {{ from: string, to: string, currency: string, limit?: number }} query
   * @returns {Promise<Array<{ seller_id: string, display_name: string, revenue: number }>>}
   */
  async topSellers({ from, to, currency, limit = 5 }) {
    const rows = await this._select(
      `
      SELECT
        p.seller_id,
        MAX(COALESCE(NULLIF(btrim(pr.full_name), ''), pr.username)) AS display_name,
        COALESCE(SUM(oi.subtotal), 0)::float AS revenue
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.profiles pr ON pr.id = p.seller_id
      WHERE ${ORDER_RANGE}
        AND o.currency = :currency
      GROUP BY p.seller_id
      ORDER BY revenue DESC, display_name ASC
      LIMIT :limit
      `,
      { from, to, currency, limit }
    );

    return rows.map((row) => ({
      seller_id: row.seller_id,
      display_name: row.display_name,
      revenue: Number(row.revenue) || 0,
    }));
  }

  /**
   * Units sold across every currency. Ranking stays comparable when orders
   * mix BOB, USD, and the rest.
   *
   * @param {{ from: string, to: string, limit?: number }} query
   * @returns {Promise<Array<{ product_id: string, title: string, units_sold: number }>>}
   */
  async topSellingProducts({ from, to, limit = 5 }) {
    const rows = await this._select(
      `
      SELECT
        oi.product_id,
        MAX(oi.product_name) AS title,
        COALESCE(SUM(oi.quantity), 0)::int AS units_sold
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE ${ORDER_RANGE}
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
      ORDER BY units_sold DESC, title ASC
      LIMIT :limit
      `,
      { from, to, limit }
    );

    return rows.map((row) => ({
      product_id: row.product_id,
      title: row.title,
      units_sold: Number(row.units_sold) || 0,
    }));
  }

  /**
   * Role totals and the pending queue are a snapshot. Registrations and
   * "active" counts follow the date range.
   *
   * @param {{ from: string, to: string }} range
   * @returns {Promise<Object>}
   */
  async userMetrics({ from, to }) {
    const rows = await this._select(
      `
      SELECT
        (SELECT COUNT(*) FROM public.profiles)::int AS total_users,
        (
          SELECT COUNT(*)
          FROM public.profiles
          WHERE created_at >= (:from)::date
            AND created_at < ((:to)::date + interval '1 day')
        )::int AS new_registrations,
        (
          SELECT COUNT(DISTINCT ur.profile_id)
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE r.name = 'buyer'
        )::int AS buyer_count,
        (
          SELECT COUNT(DISTINCT ur.profile_id)
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE r.name = 'seller'
        )::int AS seller_count,
        (
          SELECT COUNT(DISTINCT o.buyer_id)
          FROM public.orders o
          WHERE ${ORDER_RANGE}
        )::int AS active_buyers,
        (
          SELECT COUNT(DISTINCT p.seller_id)
          FROM public.order_items oi
          JOIN public.orders o ON o.id = oi.order_id
          JOIN public.products p ON p.id = oi.product_id
          WHERE ${ORDER_RANGE}
        )::int AS active_sellers,
        (
          SELECT COUNT(*)
          FROM public.seller_applications
          WHERE status = 'pending'
        )::int AS pending_seller_applications
      `,
      { from, to }
    );

    const row = rows[0] || {};
    return {
      total_users: Number(row.total_users) || 0,
      new_registrations: Number(row.new_registrations) || 0,
      buyer_count: Number(row.buyer_count) || 0,
      seller_count: Number(row.seller_count) || 0,
      active_buyers: Number(row.active_buyers) || 0,
      active_sellers: Number(row.active_sellers) || 0,
      pending_seller_applications: Number(row.pending_seller_applications) || 0,
    };
  }

  /**
   * Catalog state counts are a snapshot. `new_listings` follows the date range.
   *
   * @param {{ from: string, to: string }} range
   * @returns {Promise<Object>}
   */
  async productMetrics({ from, to }) {
    const rows = await this._select(
      `
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total_products,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND state = 'published')::int AS published_products,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND state = 'draft')::int AS draft_products,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND state = 'unpublished')::int AS unpublished_products,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND state = 'archived')::int AS archived_products,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL
            AND created_at >= (:from)::date
            AND created_at < ((:to)::date + interval '1 day')
        )::int AS new_listings
      FROM public.products
      `,
      { from, to }
    );

    const row = rows[0] || {};
    return {
      total_products: Number(row.total_products) || 0,
      published_products: Number(row.published_products) || 0,
      draft_products: Number(row.draft_products) || 0,
      unpublished_products: Number(row.unpublished_products) || 0,
      archived_products: Number(row.archived_products) || 0,
      new_listings: Number(row.new_listings) || 0,
    };
  }

  /**
   * @param {{ limit?: number }} [options]
   * @returns {Promise<Array<{ category_id: string, name: string, product_count: number }>>}
   */
  async topCategories({ limit = 5 } = {}) {
    const rows = await this._select(
      `
      SELECT
        c.id AS category_id,
        c.name,
        COUNT(p.id)::int AS product_count
      FROM public.products p
      JOIN public.categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY product_count DESC, c.name ASC
      LIMIT :limit
      `,
      { limit }
    );

    return rows.map((row) => ({
      category_id: row.category_id,
      name: row.name,
      product_count: Number(row.product_count) || 0,
    }));
  }

  /**
   * @param {{ limit?: number }} [options]
   * @returns {Promise<Array<{ product_id: string, title: string, average_rating: number, rating_count: number }>>}
   */
  async topRatedProducts({ limit = 5 } = {}) {
    const rows = await this._select(
      `
      SELECT
        id AS product_id,
        name AS title,
        average_rating::float AS average_rating,
        ratings_count::int AS rating_count
      FROM public.products
      WHERE deleted_at IS NULL
        AND ratings_count > 0
      ORDER BY average_rating DESC, ratings_count DESC, name ASC
      LIMIT :limit
      `,
      { limit }
    );

    return rows.map((row) => ({
      product_id: row.product_id,
      title: row.title,
      average_rating: Number(row.average_rating) || 0,
      rating_count: Number(row.rating_count) || 0,
    }));
  }
}
