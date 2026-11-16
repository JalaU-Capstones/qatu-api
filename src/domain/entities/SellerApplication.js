export const SELLER_APPLICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

const VALID_STATUSES = Object.values(SELLER_APPLICATION_STATUS);

export class SellerApplication {
  constructor({
    id = null,
    profileId,
    profile_id,
    businessName,
    business_name,
    businessDescription,
    business_description,
    contactPhone = null,
    contact_phone,
    contactEmail = null,
    contact_email,
    status = SELLER_APPLICATION_STATUS.PENDING,
    reviewedBy = null,
    reviewed_by,
    reviewedAt = null,
    reviewed_at,
    rejectionReason = null,
    rejection_reason,
    createdAt,
    created_at,
    updatedAt,
    updated_at,
  }) {
    const resolvedProfileId = profileId || profile_id;
    const resolvedBusinessName = (businessName ?? business_name ?? '').trim();
    const resolvedDescription = (businessDescription ?? business_description ?? '').trim();

    if (!resolvedProfileId) {
      throw new Error('SellerApplication profile_id is required');
    }
    if (resolvedBusinessName.length < 2 || resolvedBusinessName.length > 120) {
      throw new Error('Business name must be between 2 and 120 characters.');
    }
    if (resolvedDescription.length < 20 || resolvedDescription.length > 2000) {
      throw new Error('Business description must be between 20 and 2000 characters.');
    }
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid seller application status: ${status}`);
    }

    this.id = id;
    this.profileId = resolvedProfileId;
    this.profile_id = resolvedProfileId;
    this.businessName = resolvedBusinessName;
    this.business_name = resolvedBusinessName;
    this.businessDescription = resolvedDescription;
    this.business_description = resolvedDescription;
    this.contactPhone = contactPhone !== undefined ? contactPhone : (contact_phone ?? null);
    this.contact_phone = this.contactPhone;
    this.contactEmail = contactEmail !== undefined ? contactEmail : (contact_email ?? null);
    this.contact_email = this.contactEmail;
    this.status = status;
    this.reviewedBy = reviewedBy !== undefined ? reviewedBy : (reviewed_by ?? null);
    this.reviewed_by = this.reviewedBy;

    const rawReviewedAt = reviewedAt || reviewed_at;
    this.reviewedAt = rawReviewedAt ? new Date(rawReviewedAt) : null;
    this.reviewed_at = this.reviewedAt ? this.reviewedAt.toISOString() : null;

    this.rejectionReason =
      rejectionReason !== undefined ? rejectionReason : (rejection_reason ?? null);
    this.rejection_reason = this.rejectionReason;

    const rawCreated = createdAt || created_at;
    const rawUpdated = updatedAt || updated_at;
    this.createdAt = rawCreated ? new Date(rawCreated) : new Date();
    this.updatedAt = rawUpdated ? new Date(rawUpdated) : new Date();
  }

  isPending() {
    return this.status === SELLER_APPLICATION_STATUS.PENDING;
  }

  toJSON() {
    return {
      id: this.id,
      profile_id: this.profileId,
      business_name: this.businessName,
      business_description: this.businessDescription,
      contact_phone: this.contactPhone,
      contact_email: this.contactEmail,
      status: this.status,
      reviewed_by: this.reviewedBy,
      reviewed_at: this.reviewedAt ? this.reviewedAt.toISOString() : null,
      rejection_reason: this.rejectionReason,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    };
  }
}
