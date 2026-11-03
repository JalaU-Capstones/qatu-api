import { QueryTypes } from 'sequelize';
import { Order } from '../../../domain/entities/Order.js';
import { OrderItem } from '../../../domain/entities/OrderItem.js';
import { IOrderRepository } from '../../../domain/repositories/IOrderRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class OrderRepository extends IOrderRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /**
   * Returns a paginated list of orders for a specific buyer.
   *
   * @param {Object} params
   * @param {string} params.buyerId
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.status]
   * @returns {Promise<{ items: Order[], total: number }>}
   */
  async findByBuyerId({ buyerId, page = 1, limit = 20, status } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereConditions = ['buyer_id = :buyerId'];
    const replacements = { buyerId };

    if (status) {
      whereConditions.push('status = :status');
      replacements.status = status;
    }

    const whereClause = whereConditions.join(' AND ');

    const countResult = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM public.orders
       WHERE ${whereClause}`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    const total = countResult && countResult[0] ? Number(countResult[0].total) : 0;
    if (total === 0) {
      return { items: [], total: 0 };
    }

    const rows = await this.db.query(
      `SELECT id, order_number, buyer_id, status, currency, subtotal, shipping_cost, tax, total,
              shipping_address, notes, cancellation_reason, confirmed_at, shipped_at, delivered_at,
              cancelled_at, created_at, updated_at
       FROM public.orders
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { ...replacements, limit: limitNum, offset },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return { items: [], total };
    }

    const orderIds = rows.map((r) => r.id);
    const itemRows = await this.db.query(
      `SELECT id, order_id, product_id, product_name, product_image_path, quantity, unit_price, subtotal, created_at
       FROM public.order_items
       WHERE order_id IN (:orderIds)
       ORDER BY created_at ASC`,
      {
        replacements: { orderIds },
        type: QueryTypes.SELECT,
      }
    );

    const itemsByOrderId = new Map();
    for (const itemRow of itemRows || []) {
      const list = itemsByOrderId.get(itemRow.order_id) || [];
      list.push(
        new OrderItem({
          id: itemRow.id,
          orderId: itemRow.order_id,
          productId: itemRow.product_id,
          productName: itemRow.product_name,
          productImagePath: itemRow.product_image_path,
          quantity: itemRow.quantity,
          unitPrice: Number(itemRow.unit_price),
          subtotal: itemRow.subtotal !== null ? Number(itemRow.subtotal) : null,
          createdAt: itemRow.created_at,
        })
      );
      itemsByOrderId.set(itemRow.order_id, list);
    }

    const items = rows.map(
      (row) =>
        new Order({
          id: row.id,
          orderNumber: row.order_number,
          buyerId: row.buyer_id,
          status: row.status,
          currency: row.currency,
          subtotal: Number(row.subtotal),
          shippingCost: Number(row.shipping_cost),
          tax: Number(row.tax),
          total: Number(row.total),
          shippingAddress: row.shipping_address,
          notes: row.notes,
          cancellationReason: row.cancellation_reason,
          confirmedAt: row.confirmed_at,
          shippedAt: row.shipped_at,
          deliveredAt: row.delivered_at,
          cancelledAt: row.cancelled_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          items: itemsByOrderId.get(row.id) || [],
        })
    );

    return { items, total };
  }

  /** Inserts a pending order and its items (order_number and item subtotal are DB-generated). */
  async createWithItems(
    { buyerId, currency, subtotal, shippingCost, tax, total, shippingAddress, notes = null, items },
    { transaction } = {}
  ) {
    const queryOptions = transaction ? { transaction } : {};

    const orderRows = await this.db.query(
      `INSERT INTO public.orders
         (buyer_id, status, currency, subtotal, shipping_cost, tax, total, shipping_address, notes)
       VALUES
         (:buyerId, 'pending', :currency, :subtotal, :shippingCost, :tax, :total,
          CAST(:shippingAddress AS jsonb), :notes)
       RETURNING id, order_number, buyer_id, status, currency, subtotal, shipping_cost, tax, total,
                 shipping_address, notes, cancellation_reason, confirmed_at, shipped_at,
                 delivered_at, cancelled_at, created_at, updated_at`,
      {
        replacements: {
          buyerId,
          currency,
          subtotal,
          shippingCost,
          tax,
          total,
          shippingAddress: JSON.stringify(shippingAddress),
          notes,
        },
        type: QueryTypes.SELECT,
        ...queryOptions,
      }
    );

    if (!orderRows || orderRows.length === 0) {
      throw new Error('Failed to create order: no row returned');
    }
    const orderRow = orderRows[0];

    const itemEntities = [];
    for (const item of items) {
      const itemRows = await this.db.query(
        `INSERT INTO public.order_items
           (order_id, product_id, product_name, product_image_path, quantity, unit_price)
         VALUES
           (:orderId, :productId, :productName, :productImagePath, :quantity, :unitPrice)
         RETURNING id, order_id, product_id, product_name, product_image_path, quantity,
                   unit_price, subtotal, created_at`,
        {
          replacements: {
            orderId: orderRow.id,
            productId: item.productId,
            productName: item.productName,
            productImagePath: item.productImagePath ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
          type: QueryTypes.SELECT,
          ...queryOptions,
        }
      );

      const itemRow = itemRows[0];
      itemEntities.push(
        new OrderItem({
          id: itemRow.id,
          orderId: itemRow.order_id,
          productId: itemRow.product_id,
          productName: itemRow.product_name,
          productImagePath: itemRow.product_image_path,
          quantity: itemRow.quantity,
          unitPrice: Number(itemRow.unit_price),
          subtotal: itemRow.subtotal !== null ? Number(itemRow.subtotal) : null,
          createdAt: itemRow.created_at,
        })
      );
    }

    return new Order({
      id: orderRow.id,
      orderNumber: orderRow.order_number,
      buyerId: orderRow.buyer_id,
      status: orderRow.status,
      currency: orderRow.currency,
      subtotal: Number(orderRow.subtotal),
      shippingCost: Number(orderRow.shipping_cost),
      tax: Number(orderRow.tax),
      total: Number(orderRow.total),
      shippingAddress: orderRow.shipping_address,
      notes: orderRow.notes,
      cancellationReason: orderRow.cancellation_reason,
      confirmedAt: orderRow.confirmed_at,
      shippedAt: orderRow.shipped_at,
      deliveredAt: orderRow.delivered_at,
      cancelledAt: orderRow.cancelled_at,
      createdAt: orderRow.created_at,
      updatedAt: orderRow.updated_at,
      items: itemEntities,
    });
  }

  /**
   * Returns an order by its unique identifier, or null if not found.
   *
   * @param {string} orderId
   * @returns {Promise<Order|null>}
   */
  async findById(orderId) {
    const rows = await this.db.query(
      `SELECT id, order_number, buyer_id, status, currency, subtotal, shipping_cost, tax, total,
              shipping_address, notes, cancellation_reason, confirmed_at, shipped_at, delivered_at,
              cancelled_at, created_at, updated_at
       FROM public.orders
       WHERE id = :orderId
       LIMIT 1`,
      {
        replacements: { orderId },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];

    const itemRows = await this.db.query(
      `SELECT id, order_id, product_id, product_name, product_image_path, quantity, unit_price, subtotal, created_at
       FROM public.order_items
       WHERE order_id = :orderId
       ORDER BY created_at ASC`,
      {
        replacements: { orderId },
        type: QueryTypes.SELECT,
      }
    );

    const items = (itemRows || []).map(
      (itemRow) =>
        new OrderItem({
          id: itemRow.id,
          orderId: itemRow.order_id,
          productId: itemRow.product_id,
          productName: itemRow.product_name,
          productImagePath: itemRow.product_image_path,
          quantity: itemRow.quantity,
          unitPrice: Number(itemRow.unit_price),
          subtotal: itemRow.subtotal !== null ? Number(itemRow.subtotal) : null,
          createdAt: itemRow.created_at,
        })
    );

    return new Order({
      id: row.id,
      orderNumber: row.order_number,
      buyerId: row.buyer_id,
      status: row.status,
      currency: row.currency,
      subtotal: Number(row.subtotal),
      shippingCost: Number(row.shipping_cost),
      tax: Number(row.tax),
      total: Number(row.total),
      shippingAddress: row.shipping_address,
      notes: row.notes,
      cancellationReason: row.cancellation_reason,
      confirmedAt: row.confirmed_at,
      shippedAt: row.shipped_at,
      deliveredAt: row.delivered_at,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items,
    });
  }
}
