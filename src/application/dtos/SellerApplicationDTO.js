export class ApplyAsSellerRequestDTO {
  constructor({
    profileId,
    business_name,
    business_description,
    contact_phone = null,
    contact_email = null,
  }) {
    this.profileId = profileId;
    this.businessName = business_name;
    this.businessDescription = business_description;
    this.contactPhone = contact_phone;
    this.contactEmail = contact_email;
  }
}

export class SellerApplicationResponseDTO {
  static fromEntity(entity) {
    return {
      data: entity.toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
