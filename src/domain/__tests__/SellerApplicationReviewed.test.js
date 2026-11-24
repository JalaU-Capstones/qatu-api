import { describe, expect, it } from 'vitest';
import {
  SELLER_APPROVED_EVENT_TYPE,
  SELLER_APPROVED_ROUTING_KEY,
  SELLER_REJECTED_EVENT_TYPE,
  SELLER_REJECTED_ROUTING_KEY,
  buildSellerApprovedEvent,
  buildSellerRejectedEvent,
} from '../events/SellerApplicationReviewed.js';

describe('SellerApplicationReviewed domain events', () => {
  const application = { id: 'application-1', profileId: 'profile-1' };

  it('exposes the event type and routing key constants', () => {
    expect(SELLER_APPROVED_EVENT_TYPE).toBe('SellerApproved');
    expect(SELLER_APPROVED_ROUTING_KEY).toBe('seller_application.approved');
    expect(SELLER_REJECTED_EVENT_TYPE).toBe('SellerRejected');
    expect(SELLER_REJECTED_ROUTING_KEY).toBe('seller_application.rejected');
  });

  it('builds the approval event', () => {
    expect(buildSellerApprovedEvent({ application, reviewedBy: 'admin-1' })).toEqual({
      eventType: 'SellerApproved',
      aggregateType: 'seller_application',
      aggregateId: 'application-1',
      routingKey: 'seller_application.approved',
      payload: {
        application_id: 'application-1',
        profile_id: 'profile-1',
        reviewed_by: 'admin-1',
      },
    });
  });

  it('builds the rejection event with an explicit reason', () => {
    expect(
      buildSellerRejectedEvent({
        application,
        reviewedBy: 'admin-2',
        rejectionReason: 'Incomplete documentation',
      })
    ).toEqual({
      eventType: 'SellerRejected',
      aggregateType: 'seller_application',
      aggregateId: 'application-1',
      routingKey: 'seller_application.rejected',
      payload: {
        application_id: 'application-1',
        profile_id: 'profile-1',
        reviewed_by: 'admin-2',
        rejection_reason: 'Incomplete documentation',
      },
    });
  });

  it('defaults the rejection reason to null', () => {
    const event = buildSellerRejectedEvent({ application, reviewedBy: null });

    expect(event.payload.rejection_reason).toBeNull();
  });
});
