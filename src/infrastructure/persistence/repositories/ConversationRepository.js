import { QueryTypes } from 'sequelize';
import { Conversation } from '../../../domain/entities/Conversation.js';
import { IConversationRepository } from '../../../domain/repositories/IConversationRepository.js';
import { sequelize } from '../../config/sequelize.js';

const NULL_PRODUCT_SENTINEL = '00000000-0000-0000-0000-000000000000';

export class ConversationRepository extends IConversationRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  toDomain(row) {
    if (!row) return null;
    return new Conversation({
      id: row.id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      productId: row.product_id ?? null,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findById(id) {
    const rows = await this.db.query(
      `SELECT id, buyer_id, seller_id, product_id, last_message_at, created_at, updated_at
       FROM public.conversations
       WHERE id = :id
       LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findOrCreate({ buyerId, sellerId, productId = null }) {
    const normalizedProductId = productId || null;

    const inserted = await this.db.query(
      `INSERT INTO public.conversations (buyer_id, seller_id, product_id)
       VALUES (:buyerId, :sellerId, :productId)
       ON CONFLICT (buyer_id, seller_id, coalesce(product_id, '${NULL_PRODUCT_SENTINEL}'::uuid))
       DO NOTHING
       RETURNING id, buyer_id, seller_id, product_id, last_message_at, created_at, updated_at`,
      {
        replacements: {
          buyerId,
          sellerId,
          productId: normalizedProductId,
        },
        type: QueryTypes.SELECT,
      }
    );

    if (inserted.length > 0) {
      return {
        conversation: this.toDomain(inserted[0]),
        created: true,
      };
    }

    const existing = await this.db.query(
      `SELECT id, buyer_id, seller_id, product_id, last_message_at, created_at, updated_at
       FROM public.conversations
       WHERE buyer_id = :buyerId
         AND seller_id = :sellerId
         AND coalesce(product_id, '${NULL_PRODUCT_SENTINEL}'::uuid) = coalesce(:productId, '${NULL_PRODUCT_SENTINEL}'::uuid)
       LIMIT 1`,
      {
        replacements: {
          buyerId,
          sellerId,
          productId: normalizedProductId,
        },
        type: QueryTypes.SELECT,
      }
    );

    return {
      conversation: existing.length > 0 ? this.toDomain(existing[0]) : null,
      created: false,
    };
  }

  async listByUser(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const countRows = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM public.conversations
       WHERE buyer_id = :userId OR seller_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    const total = Number(countRows[0]?.total ?? 0);

    const rows = await this.db.query(
      `SELECT id, buyer_id, seller_id, product_id, last_message_at, created_at, updated_at
       FROM public.conversations
       WHERE buyer_id = :userId OR seller_id = :userId
       ORDER BY last_message_at DESC, created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { userId, limit, offset },
        type: QueryTypes.SELECT,
      }
    );

    return {
      items: rows.map((row) => this.toDomain(row)),
      total,
    };
  }
}
