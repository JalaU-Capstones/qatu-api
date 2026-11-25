import { QueryTypes } from 'sequelize';
import { Message } from '../../../domain/entities/Message.js';
import { IMessageRepository } from '../../../domain/repositories/IMessageRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class MessageRepository extends IMessageRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  toDomain(row) {
    if (!row) return null;
    return new Message({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      readAt: row.read_at ?? null,
      editedAt: row.edited_at ?? null,
      deletedAt: row.deleted_at ?? null,
      createdAt: row.created_at,
    });
  }

  async create({ conversationId, senderId, content }, { transaction } = {}) {
    const rows = await this.db.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content)
       VALUES (:conversationId, :senderId, :content)
       RETURNING id, conversation_id, sender_id, content, read_at, edited_at, deleted_at, created_at`,
      {
        replacements: { conversationId, senderId, content },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async listByConversation(conversationId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const countRows = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM public.messages
       WHERE conversation_id = :conversationId AND deleted_at IS NULL`,
      {
        replacements: { conversationId },
        type: QueryTypes.SELECT,
      }
    );

    const total = Number(countRows[0]?.total ?? 0);

    const rows = await this.db.query(
      `SELECT id, conversation_id, sender_id, content, read_at, edited_at, deleted_at, created_at
       FROM public.messages
       WHERE conversation_id = :conversationId AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { conversationId, limit, offset },
        type: QueryTypes.SELECT,
      }
    );

    return {
      items: rows.map((row) => this.toDomain(row)),
      total,
    };
  }
}
