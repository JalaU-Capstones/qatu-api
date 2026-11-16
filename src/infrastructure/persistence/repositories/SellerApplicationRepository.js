import {
  SELLER_APPLICATION_STATUS,
  SellerApplication,
} from '../../../domain/entities/SellerApplication.js';
import { ISellerApplicationRepository } from '../../../domain/repositories/ISellerApplicationRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class SellerApplicationRepository extends ISellerApplicationRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  toDomain(row) {
    if (!row) return null;
    return new SellerApplication({
      id: row.id,
      profile_id: row.profile_id,
      business_name: row.business_name,
      business_description: row.business_description,
      contact_phone: row.contact_phone,
      contact_email: row.contact_email,
      status: row.status,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  async create(application, { transaction } = {}) {
    const query = `
      INSERT INTO public.seller_applications (
        profile_id,
        business_name,
        business_description,
        contact_phone,
        contact_email,
        status
      )
      VALUES (
        :profile_id,
        :business_name,
        :business_description,
        :contact_phone,
        :contact_email,
        :status
      )
      RETURNING
        id,
        profile_id,
        business_name,
        business_description,
        contact_phone,
        contact_email,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at
    `;

    try {
      const [rows] = await this.db.query(query, {
        replacements: {
          profile_id: application.profileId,
          business_name: application.businessName,
          business_description: application.businessDescription,
          contact_phone: application.contactPhone || null,
          contact_email: application.contactEmail || null,
          status: application.status || SELLER_APPLICATION_STATUS.PENDING,
        },
        transaction,
      });

      return this.toDomain(rows[0]);
    } catch (error) {
      if (error?.original?.code === '23505' || error?.parent?.code === '23505') {
        const conflict = new Error('You already have a pending application');
        conflict.code = 'DUPLICATE_APPLICATION';
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  async findPendingByProfileId(profileId, { transaction } = {}) {
    const query = `
      SELECT
        id, profile_id, business_name, business_description,
        contact_phone, contact_email, status, reviewed_by,
        reviewed_at, rejection_reason, created_at, updated_at
      FROM public.seller_applications
      WHERE profile_id = :profileId
        AND status = :status
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [rows] = await this.db.query(query, {
      replacements: {
        profileId,
        status: SELLER_APPLICATION_STATUS.PENDING,
      },
      transaction,
    });

    return rows && rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findLatestByProfileId(profileId, { transaction } = {}) {
    const query = `
      SELECT
        id, profile_id, business_name, business_description,
        contact_phone, contact_email, status, reviewed_by,
        reviewed_at, rejection_reason, created_at, updated_at
      FROM public.seller_applications
      WHERE profile_id = :profileId
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [rows] = await this.db.query(query, {
      replacements: { profileId },
      transaction,
    });

    return rows && rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findById(id, { transaction } = {}) {
    const query = `
      SELECT
        id, profile_id, business_name, business_description,
        contact_phone, contact_email, status, reviewed_by,
        reviewed_at, rejection_reason, created_at, updated_at
      FROM public.seller_applications
      WHERE id = :id
      LIMIT 1
    `;
    const [rows] = await this.db.query(query, {
      replacements: { id },
      transaction,
    });
    return rows && rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async findAllPaginated({ status = null, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const whereClause = status ? 'WHERE status = :status' : '';
    const replacements = { limit: safeLimit, offset };
    if (status) replacements.status = status;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM public.seller_applications
      ${whereClause}
    `;
    const [countRows] = await this.db.query(countQuery, { replacements });
    const total = countRows?.[0]?.total ?? 0;

    const dataQuery = `
      SELECT
        id, profile_id, business_name, business_description,
        contact_phone, contact_email, status, reviewed_by,
        reviewed_at, rejection_reason, created_at, updated_at
      FROM public.seller_applications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    const [rows] = await this.db.query(dataQuery, { replacements });

    return {
      items: (rows || []).map((row) => this.toDomain(row)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async review({ id, status, reviewedBy, rejectionReason = null }, { transaction } = {}) {
    const query = `
      UPDATE public.seller_applications
      SET
        status = :status,
        reviewed_by = :reviewed_by,
        reviewed_at = now(),
        rejection_reason = :rejection_reason
      WHERE id = :id
        AND status = 'pending'
      RETURNING
        id, profile_id, business_name, business_description,
        contact_phone, contact_email, status, reviewed_by,
        reviewed_at, rejection_reason, created_at, updated_at
    `;
    const [rows] = await this.db.query(query, {
      replacements: {
        id,
        status,
        reviewed_by: reviewedBy,
        rejection_reason: status === 'rejected' ? rejectionReason : null,
      },
      transaction,
    });
    return rows && rows.length > 0 ? this.toDomain(rows[0]) : null;
  }
}
