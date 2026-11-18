export const SELLER_APPROVED_EVENT_TYPE = 'SellerApproved';
export const SELLER_APPROVED_ROUTING_KEY = 'seller_application.approved';

export const SELLER_REJECTED_EVENT_TYPE = 'SellerRejected';
export const SELLER_REJECTED_ROUTING_KEY = 'seller_application.rejected';

export function buildSellerApprovedEvent({ application, reviewedBy }) {
  return {
    eventType: SELLER_APPROVED_EVENT_TYPE,
    aggregateType: 'seller_application',
    aggregateId: application.id,
    routingKey: SELLER_APPROVED_ROUTING_KEY,
    payload: {
      application_id: application.id,
      profile_id: application.profileId,
      reviewed_by: reviewedBy,
    },
  };
}

export function buildSellerRejectedEvent({ application, reviewedBy, rejectionReason = null }) {
  return {
    eventType: SELLER_REJECTED_EVENT_TYPE,
    aggregateType: 'seller_application',
    aggregateId: application.id,
    routingKey: SELLER_REJECTED_ROUTING_KEY,
    payload: {
      application_id: application.id,
      profile_id: application.profileId,
      reviewed_by: reviewedBy,
      rejection_reason: rejectionReason,
    },
  };
}
