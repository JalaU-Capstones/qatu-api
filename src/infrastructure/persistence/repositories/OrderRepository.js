import { QueryTypes } from 'sequelize';
import { Order } from '../../../domain/entities/Order.js';
import { OrderItem } from '../../../domain/entities/OrderItem.js';
import { IOrderRepository } from '../../../domain/repositories/IOrderRepository.js';
import { sequelize } from '../../config/sequelize.js';

const ORDER_SELECT_COLUMNS = `id, order_number, buyer_id, status, currency, subtotal, shipping_cost, tax, total,
              shipping_address, notes, cancellation_reason, confirmed_at, shipped_at, delivered_at,
              cancelled_at, created_at, updated_at`;

export class OrderRepository extends IOrderRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /** @private */
  _pagination({ page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
    return { pageNum, limitNum, offset: (pageNum - 1) * limitNum };
  }

  /** @private */
  _mapItemRow(itemRow) {
    return new OrderItem({
      id: itemRow.id,
      orderId: itemRow.order_id,
      productId: itemRow.product_id,
      productName: itemRow.product_name,
      productImagePath: itemRow.product_image_path,
      quantity: itemRow.quantity,
      unitPrice: Number(itemRow.unit_price),
      subtotal: itemRow.subtotal !== null ? Number(itemRow.subtotal) : null,
      createdAt: itemRow.created_at,
    });
  }

  /** @private */
  _mapOrderRow(row, items = []) {
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

  /** @private */
  async _loadItemsByOrderIds(orderIds, { sellerId = null } = {}) {
    if (!orderIds || orderIds.length === 0) {
      return new Map();
    }

    let sql = `SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_image_path,
                      oi.quantity, oi.unit_price, oi.subtotal, oi.created_at
               FROM public.order_items oi`;
    const replacements = { orderIds };

    if (sellerId) {
      sql += `
           INNER JOIN public.products p ON p.id = oi.product_id
           WHERE oi.order_id IN (:orderIds) AND p.seller_id = :sellerId`;
      replacements.sellerId = sellerId;
    } else {
      sql += ` WHERE oi.order_id IN (:orderIds)`;
    }
    sql += ` ORDER BY oi.created_at ASC`;

    const itemRows = await this.db.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });

    const itemsByOrderId = new Map();
    for (const itemRow of itemRows || []) {
      const list = itemsByOrderId.get(itemRow.order_id) || [];
      list.push(this._mapItemRow(itemRow));
      itemsByOrderId.set(itemRow.order_id, list);
    }
    return itemsByOrderId;
  }

  /** Paginated buyer orders. */
  async findByBuyerId({ buyerId, page = 1, limit = 20, status } = {}) {
    const { limitNum, offset } = this._pagination({ page, limit });

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
      `SELECT ${ORDER_SELECT_COLUMNS}
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

    const itemsByOrderId = await this._loadItemsByOrderIds(rows.map((r) => r.id));
    return {
      items: rows.map((row) => this._mapOrderRow(row, itemsByOrderId.get(row.id) || [])),
      total,
    };
  }

  async findBySellerId({ sellerId, page = 1, limit = 20, status } = {}) {
    const { limitNum, offset } = this._pagination({ page, limit });
    const replacements = { sellerId };
    const statusClause = status ? 'AND o.status = :status' : '';
    if (status) {
      replacements.status = status;
    }

    const sellerExists = `EXISTS (
         SELECT 1
         FROM public.order_items oi
         INNER JOIN public.products p ON p.id = oi.product_id
         WHERE oi.order_id = o.id AND p.seller_id = :sellerId
       )`;

    const countResult = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM public.orders o
       WHERE ${sellerExists}
       ${statusClause}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const total = countResult && countResult[0] ? Number(countResult[0].total) : 0;
    if (total === 0) {
      return { items: [], total: 0 };
    }

    const rows = await this.db.query(
      `SELECT o.id, o.order_number, o.buyer_id, o.status, o.currency, o.subtotal, o.shipping_cost, o.tax, o.total,
              o.shipping_address, o.notes, o.cancellation_reason, o.confirmed_at, o.shipped_at, o.delivered_at,
              o.cancelled_at, o.created_at, o.updated_at
       FROM public.orders o
       WHERE ${sellerExists}
       ${statusClause}
       ORDER BY o.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { ...replacements, limit: limitNum, offset },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows || rows.length === 0) {
      return { items: [], total };
    }

    const itemsByOrderId = await this._loadItemsByOrderIds(
      rows.map((r) => r.id),
      { sellerId }
    );
    return {
      items: rows.map((row) => this._mapOrderRow(row, itemsByOrderId.get(row.id) || [])),
      total,
    };
  }

  async findAll({ page = 1, limit = 20, status } = {}) {
    const { limitNum, offset } = this._pagination({ page, limit });
    const replacements = {};
    const whereConditions = [];
    if (status) {
      whereConditions.push('status = :status');
      replacements.status = status;
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await this.db.query(
      `SELECT COUNT(*) AS total FROM public.orders ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );
    const total = countResult && countResult[0] ? Number(countResult[0].total) : 0;
    if (total === 0) {
      return { items: [], total: 0 };
    }

    const rows = await this.db.query(
      `SELECT ${ORDER_SELECT_COLUMNS}
       FROM public.orders
       ${whereClause}
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

    const itemsByOrderId = await this._loadItemsByOrderIds(rows.map((r) => r.id));
    return {
      items: rows.map((row) => this._mapOrderRow(row, itemsByOrderId.get(row.id) || [])),
      total,
    };
  }

  /** Insert pending order + items. */
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

  /** @returns {Promise<Order|null>} */
  async findById(orderId) {
    const rows = await this.db.query(
      `SELECT ${ORDER_SELECT_COLUMNS}
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

    const itemsByOrderId = await this._loadItemsByOrderIds([orderId]);
    return this._mapOrderRow(rows[0], itemsByOrderId.get(orderId) || []);
  }

  async sellerHasItemsOnOrder(orderId, sellerId) {
    const rows = await this.db.query(
      `SELECT 1 AS ok
       FROM public.order_items oi
       INNER JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = :orderId AND p.seller_id = :sellerId
       LIMIT 1`,
      {
        replacements: { orderId, sellerId },
        type: QueryTypes.SELECT,
      }
    );
    return Boolean(rows && rows.length > 0);
  }

  async findByIdForSeller(orderId, sellerId) {
    const owns = await this.sellerHasItemsOnOrder(orderId, sellerId);
    if (!owns) {
      return null;
    }

    const rows = await this.db.query(
      `SELECT ${ORDER_SELECT_COLUMNS}
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

    const itemsByOrderId = await this._loadItemsByOrderIds([orderId], { sellerId });
    return this._mapOrderRow(rows[0], itemsByOrderId.get(orderId) || []);
  }

  /**
   * @param {Object} params
   * @param {string|null} [params.itemsSellerId] When set, the returned order only carries that seller's items.
   */
  async updateStatus({
    orderId,
    status,
    timestampColumn = null,
    itemsSellerId = null,
    transaction,
  } = {}) {
    const allowedTs = new Set(['confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at']);
    const tsCol = allowedTs.has(timestampColumn) ? timestampColumn : null;

    const setTs = tsCol ? `, ${tsCol} = COALESCE(${tsCol}, NOW())` : '';
    const rows = await this.db.query(
      `UPDATE public.orders
       SET status = :status
           ${setTs},
           updated_at = NOW()
       WHERE id = :orderId
       RETURNING ${ORDER_SELECT_COLUMNS}`,
      {
        replacements: { orderId, status },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const itemsByOrderId = await this._loadItemsByOrderIds([orderId], {
      sellerId: itemsSellerId,
    });
    return this._mapOrderRow(rows[0], itemsByOrderId.get(orderId) || []);
  }
}
