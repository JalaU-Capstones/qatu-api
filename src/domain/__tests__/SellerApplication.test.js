import { describe, expect, it } from 'vitest';
import { SELLER_APPLICATION_STATUS, SellerApplication } from '../entities/SellerApplication.js';

describe('SellerApplication Domain Entity', () => {
  const description = 'Handmade ceramics and slow-living home decor from the Andes.';
  const base = {
    id: 'application-1',
    profileId: 'profile-1',
    businessName: 'Andes Ceramics',
    businessDescription: description,
  };

  it('exposes frozen status constants', () => {
    expect(SELLER_APPLICATION_STATUS).toEqual({
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      WITHDRAWN: 'withdrawn',
    });
    expect(Object.isFrozen(SELLER_APPLICATION_STATUS)).toBe(true);
  });

  it('creates a pending application with defaults', () => {
    const application = new SellerApplication(base);

    expect(application.id).toBe('application-1');
    expect(application.profileId).toBe('profile-1');
    expect(application.profile_id).toBe('profile-1');
    expect(application.businessName).toBe('Andes Ceramics');
    expect(application.businessDescription).toBe(description);
    expect(application.status).toBe('pending');
    expect(application.contactPhone).toBeNull();
    expect(application.contactEmail).toBeNull();
    expect(application.reviewedBy).toBeNull();
    expect(application.reviewedAt).toBeNull();
    expect(application.reviewed_at).toBeNull();
    expect(application.rejectionReason).toBeNull();
    expect(application.createdAt).toBeInstanceOf(Date);
    expect(application.updatedAt).toBeInstanceOf(Date);
    expect(application.isPending()).toBe(true);
  });

  it('accepts snake_case aliases for every optional and required field', () => {
    const application = new SellerApplication({
      profile_id: 'profile-2',
      business_name: '  Puna Textiles  ',
      business_description: `  ${description}  `,
      contact_phone: '+591 70000000',
      contact_email: 'seller@example.com',
      status: 'approved',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-10-10T10:00:00.000Z',
      rejection_reason: 'n/a',
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-02T10:00:00.000Z',
    });

    expect(application.profileId).toBe('profile-2');
    expect(application.businessName).toBe('Puna Textiles');
    expect(application.businessDescription).toBe(description);
    // Los alias snake_case de contacto se usan cuando no llega el campo camelCase;
    // los defaults `reviewedBy = null` y `rejectionReason = null` tienen prioridad.
    expect(application.contactPhone).toBe('+591 70000000');
    expect(application.contactEmail).toBe('seller@example.com');
    expect(application.status).toBe('approved');
    expect(application.reviewedBy).toBeNull();
    expect(application.reviewedAt).toEqual(new Date('2026-10-10T10:00:00.000Z'));
    expect(application.reviewed_at).toBe('2026-10-10T10:00:00.000Z');
    expect(application.rejectionReason).toBeNull();
    expect(application.createdAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
    expect(application.updatedAt).toEqual(new Date('2026-10-02T10:00:00.000Z'));
    expect(application.isPending()).toBe(false);
  });

  it('prefers camelCase values and falls back to snake_case for empty aliases', () => {
    const application = new SellerApplication({
      ...base,
      profileId: '',
      profile_id: 'profile-fallback',
      businessName: null,
      business_name: 'Fallback Name',
      businessDescription: null,
      business_description: description,
      contactPhone: '+59111111111',
      contact_phone: '+59122222222',
      contactEmail: null,
      contact_email: 'fallback@example.com',
      reviewedBy: null,
      reviewed_by: 'admin-fallback',
      reviewedAt: null,
      reviewed_at: '2026-10-11T10:00:00.000Z',
      rejectionReason: undefined,
      rejection_reason: 'fallback reason',
      createdAt: '2026-10-03T10:00:00.000Z',
      created_at: '2020-01-01T00:00:00.000Z',
      updatedAt: '2026-10-04T10:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    });

    expect(application.profileId).toBe('profile-fallback');
    expect(application.businessName).toBe('Fallback Name');
    expect(application.businessDescription).toBe(description);
    expect(application.contactPhone).toBe('+59111111111');
    expect(application.contactEmail).toBeNull();
    expect(application.reviewedBy).toBeNull();
    expect(application.reviewedAt).toEqual(new Date('2026-10-11T10:00:00.000Z'));
    expect(application.rejectionReason).toBeNull();
  });

  it.each([['rejected'], ['withdrawn'], ['approved']])(
    'does not report isPending for status %s',
    (status) => {
      const application = new SellerApplication({
        ...base,
        status,
        reviewedAt: '2026-10-10T10:00:00.000Z',
        rejectionReason: 'Reason',
      });

      expect(application.isPending()).toBe(false);
      expect(application.toJSON().status).toBe(status);
    }
  );

  it('serializes every field with snake_case keys and ISO timestamps', () => {
    const application = new SellerApplication({
      ...base,
      contactPhone: '+591 70000000',
      contactEmail: 'seller@example.com',
      reviewedBy: 'admin-1',
      reviewedAt: '2026-10-10T10:00:00.000Z',
      rejectionReason: 'Duplicated business',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    });

    expect(application.toJSON()).toEqual({
      id: 'application-1',
      profile_id: 'profile-1',
      business_name: 'Andes Ceramics',
      business_description: description,
      contact_phone: '+591 70000000',
      contact_email: 'seller@example.com',
      status: 'pending',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-10-10T10:00:00.000Z',
      rejection_reason: 'Duplicated business',
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-02T10:00:00.000Z',
    });
  });

  it('serializes null review fields for a fresh application', () => {
    const json = new SellerApplication(base).toJSON();

    expect(json.reviewed_at).toBeNull();
    expect(json.rejection_reason).toBeNull();
    expect(typeof json.created_at).toBe('string');
    expect(typeof json.updated_at).toBe('string');
  });

  it('requires a profile id', () => {
    expect(() => new SellerApplication({ ...base, profileId: undefined })).toThrow(
      'SellerApplication profile_id is required'
    );
    expect(() => new SellerApplication({ ...base, profileId: '', profile_id: '' })).toThrow(
      'SellerApplication profile_id is required'
    );
  });

  it('validates business name length', () => {
    expect(() => new SellerApplication({ ...base, businessName: 'a' })).toThrow(
      'Business name must be between 2 and 120 characters.'
    );
    expect(() => new SellerApplication({ ...base, businessName: 'a'.repeat(121) })).toThrow(
      'Business name must be between 2 and 120 characters.'
    );
    expect(() => new SellerApplication({ ...base, businessName: null, business_name: '' })).toThrow(
      'Business name must be between 2 and 120 characters.'
    );
  });

  it('rejects too short and too long descriptions', () => {
    expect(() => new SellerApplication({ ...base, businessDescription: 'a'.repeat(19) })).toThrow(
      'Business description must be between 20 and 2000 characters.'
    );
    expect(() => new SellerApplication({ ...base, businessDescription: 'a'.repeat(2001) })).toThrow(
      'Business description must be between 20 and 2000 characters.'
    );
  });

  it('rejects unknown statuses', () => {
    expect(() => new SellerApplication({ ...base, status: 'unknown' })).toThrow(
      'Invalid seller application status: unknown'
    );
  });

  it('falls back to empty strings when both name and description aliases are absent', () => {
    expect(
      () => new SellerApplication({ profileId: 'profile-1', businessDescription: description })
    ).toThrow('Business name must be between 2 and 120 characters.');
    expect(
      () => new SellerApplication({ profileId: 'profile-1', businessName: 'Valid Name' })
    ).toThrow('Business description must be between 20 and 2000 characters.');
  });
});
