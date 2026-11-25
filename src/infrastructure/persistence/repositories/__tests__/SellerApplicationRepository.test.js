import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerApplication } from '../../../../domain/entities/SellerApplication.js';
import { SellerApplicationRepository } from '../SellerApplicationRepository.js';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const APPLICATION_ID = '22222222-2222-4222-8222-222222222222';

const applicationRow = (overrides = {}) => ({
  id: APPLICATION_ID,
  profile_id: PROFILE_ID,
  business_name: 'Mi Tienda',
  business_description: 'Venta de productos artesanales hechos a mano.',
  contact_phone: null,
  contact_email: null,
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const application = (overrides = {}) =>
  new SellerApplication({
    profileId: PROFILE_ID,
    businessName: 'Mi Tienda',
    businessDescription: 'Venta de productos artesanales hechos a mano.',
    ...overrides,
  });

describe('SellerApplicationRepository', () => {
  it('maps contact fields from database rows into the serialized application', () => {
    const repository = new SellerApplicationRepository({ db: {} });

    const domainApplication = repository.toDomain({
      id: 'application-1',
      profile_id: 'buyer-1',
      business_name: 'Tienda Andina',
      business_description: 'Artesanías elaboradas por productores locales.',
      contact_phone: '+59171234567',
      contact_email: 'contacto@tienda.pe',
      status: 'pending',
      created_at: '2026-11-23T12:00:00.000Z',
      updated_at: '2026-11-23T12:00:00.000Z',
    });

    expect(domainApplication.toJSON()).toMatchObject({
      contact_phone: '+59171234567',
      contact_email: 'contacto@tienda.pe',
    });
  });
});

describe('SellerApplicationRepository (unit)', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = { query: vi.fn() };
    repository = new SellerApplicationRepository({ db });
  });

  it('uses the shared sequelize instance by default', () => {
    expect(new SellerApplicationRepository().db).toBeDefined();
  });

  describe('toDomain', () => {
    it('maps a row and returns null for missing rows', () => {
      expect(repository.toDomain(applicationRow())).toBeInstanceOf(SellerApplication);
      expect(repository.toDomain(null)).toBeNull();
      expect(repository.toDomain(undefined)).toBeNull();
    });
  });

  describe('create', () => {
    it('persists defaults and forwards the transaction', async () => {
      db.query.mockResolvedValueOnce([[applicationRow()]]);
      const transaction = { id: 'tx' };

      const result = await repository.create(application(), { transaction });

      expect(result).toBeInstanceOf(SellerApplication);
      expect(db.query.mock.calls[0][1]).toEqual({
        replacements: {
          profile_id: PROFILE_ID,
          business_name: 'Mi Tienda',
          business_description: 'Venta de productos artesanales hechos a mano.',
          contact_phone: null,
          contact_email: null,
          status: 'pending',
        },
        transaction,
      });
    });

    it('persists explicit contact details and status', async () => {
      db.query.mockResolvedValueOnce([[applicationRow()]]);

      await repository.create({
        ...application(),
        contactPhone: '+591 77777777',
        contactEmail: 'ana@example.com',
        status: 'under_review',
      });

      expect(db.query.mock.calls[0][1].replacements).toMatchObject({
        contact_phone: '+591 77777777',
        contact_email: 'ana@example.com',
        status: 'under_review',
      });
    });

    it('falls back to the pending status for a plain payload without one', async () => {
      db.query.mockResolvedValueOnce([[applicationRow()]]);

      await repository.create({
        profileId: PROFILE_ID,
        businessName: 'Mi Tienda',
        businessDescription: 'Venta de productos artesanales hechos a mano.',
        status: '',
      });

      expect(db.query.mock.calls[0][1].replacements.status).toBe('pending');
    });

    it('detects duplicate applications through either original or parent error', async () => {
      for (const key of ['original', 'parent']) {
        db.query.mockRejectedValueOnce({ [key]: { code: '23505' } });
        await expect(repository.create(application())).rejects.toMatchObject({
          code: 'DUPLICATE_APPLICATION',
          statusCode: 409,
          message: 'You already have a pending application',
        });
      }
    });

    it('rethrows unexpected errors unchanged', async () => {
      const error = new Error('connection lost');
      db.query.mockRejectedValueOnce(error);
      await expect(repository.create(application())).rejects.toBe(error);
    });
  });

  describe('single-row lookups', () => {
    it.each([
      ['findPendingByProfileId', 'status = :status'],
      ['findLatestByProfileId', 'ORDER BY created_at DESC'],
      ['findById', 'WHERE id = :id'],
    ])('%s maps the first row or returns null', async (method, sqlFragment) => {
      db.query.mockResolvedValueOnce([[applicationRow()]]);
      // eslint-disable-next-line security/detect-object-injection
      await expect(repository[method](PROFILE_ID)).resolves.toBeInstanceOf(SellerApplication);
      expect(db.query.mock.calls[0][0]).toContain(sqlFragment);

      db.query.mockResolvedValueOnce([[]]);
      // eslint-disable-next-line security/detect-object-injection
      await expect(repository[method](PROFILE_ID)).resolves.toBeNull();

      db.query.mockResolvedValueOnce([undefined]);
      // eslint-disable-next-line security/detect-object-injection
      await expect(repository[method](PROFILE_ID)).resolves.toBeNull();
    });
  });

  describe('findAllPaginated', () => {
    it('uses defaults, omits the WHERE clause and tolerates missing rows', async () => {
      db.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([undefined]);

      await expect(repository.findAllPaginated()).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(db.query.mock.calls[0][0]).not.toContain('WHERE status');
      expect(db.query.mock.calls[0][1].replacements).toEqual({ limit: 20, offset: 0 });
    });

    it('falls back to the default limit when it is zero', async () => {
      db.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await expect(repository.findAllPaginated({ page: 2, limit: 0 })).resolves.toMatchObject({
        page: 2,
        limit: 20,
      });
    });

    it('keeps valid page and limit values', async () => {
      db.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

      await expect(repository.findAllPaginated({ page: 2, limit: 10 })).resolves.toMatchObject({
        page: 2,
        limit: 10,
      });
      expect(db.query.mock.calls[0][1].replacements).toEqual({ limit: 10, offset: 10 });
    });

    it('sanitizes pagination, filters by status and maps rows', async () => {
      db.query.mockResolvedValueOnce([undefined]).mockResolvedValueOnce([[applicationRow()]]);

      const result = await repository.findAllPaginated({
        status: 'pending',
        page: 'bad',
        limit: 500,
      });

      expect(result).toMatchObject({ total: 0, page: 1, limit: 100 });
      expect(db.query.mock.calls[0][0]).toContain('WHERE status = :status');
      expect(db.query.mock.calls[0][1].replacements).toEqual({
        limit: 100,
        offset: 0,
        status: 'pending',
      });
    });
  });

  describe('review', () => {
    it('stores the rejection reason only for rejected applications', async () => {
      db.query.mockResolvedValueOnce([
        [applicationRow({ status: 'rejected', rejection_reason: 'Datos incompletos' })],
      ]);

      await expect(
        repository.review({
          id: APPLICATION_ID,
          status: 'rejected',
          reviewedBy: 'admin-1',
          rejectionReason: 'Datos incompletos',
        })
      ).resolves.toBeInstanceOf(SellerApplication);
      expect(db.query.mock.calls[0][1].replacements).toMatchObject({
        reviewed_by: 'admin-1',
        rejection_reason: 'Datos incompletos',
      });
    });

    it('clears the reason for approvals and returns null when nothing was updated', async () => {
      const transaction = { id: 'tx' };
      db.query.mockResolvedValueOnce([[applicationRow({ status: 'approved' })]]);

      await repository.review(
        {
          id: APPLICATION_ID,
          status: 'approved',
          reviewedBy: 'admin-1',
          rejectionReason: 'ignored',
        },
        { transaction }
      );
      expect(db.query.mock.calls[0][1]).toMatchObject({
        replacements: { rejection_reason: null },
        transaction,
      });

      db.query.mockResolvedValueOnce([]);
      await expect(
        repository.review({ id: APPLICATION_ID, status: 'approved', reviewedBy: 'admin-1' })
      ).resolves.toBeNull();

      db.query.mockResolvedValueOnce([undefined]);
      await expect(
        repository.review({ id: APPLICATION_ID, status: 'approved', reviewedBy: 'admin-1' })
      ).resolves.toBeNull();
    });
  });
});
