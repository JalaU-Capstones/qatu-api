import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSellerApplicationController } from '../AdminSellerApplicationController.js';

const APPLICATION_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

function createMockResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('AdminSellerApplicationController', () => {
  let adminListSellerApplicationsUseCase;
  let adminReviewSellerApplicationUseCase;
  let controller;

  beforeEach(() => {
    adminListSellerApplicationsUseCase = { execute: vi.fn() };
    adminReviewSellerApplicationUseCase = { execute: vi.fn() };
    controller = new AdminSellerApplicationController({
      adminListSellerApplicationsUseCase,
      adminReviewSellerApplicationUseCase,
    });
  });

  it('requires both use cases in the constructor', () => {
    expect(() => new AdminSellerApplicationController()).toThrow(
      'adminListSellerApplicationsUseCase is required'
    );
    expect(
      () => new AdminSellerApplicationController({ adminListSellerApplicationsUseCase })
    ).toThrow('adminReviewSellerApplicationUseCase is required');
  });

  describe('list', () => {
    it('responds with 200 and maps query parameters', async () => {
      const result = { data: [], meta: {} };
      adminListSellerApplicationsUseCase.execute.mockResolvedValue(result);

      const req = {
        query: { status: 'pending', page: '2', limit: '10' },
      };
      const res = createMockResponse();

      await controller.list(req, res, vi.fn());

      expect(adminListSellerApplicationsUseCase.execute).toHaveBeenCalledWith({
        status: 'pending',
        page: '2',
        limit: '10',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('prefers validated query and defaults to null status', async () => {
      adminListSellerApplicationsUseCase.execute.mockResolvedValue({ data: [], meta: {} });

      await controller.list(
        {
          query: { status: 'raw' },
          validatedQuery: { status: 'approved' },
        },
        createMockResponse(),
        vi.fn()
      );

      expect(adminListSellerApplicationsUseCase.execute).toHaveBeenCalledWith({
        status: 'approved',
        page: undefined,
        limit: undefined,
      });
    });

    it('tolerates a missing query object', async () => {
      adminListSellerApplicationsUseCase.execute.mockResolvedValue({ data: [], meta: {} });

      await controller.list({}, createMockResponse(), vi.fn());

      expect(adminListSellerApplicationsUseCase.execute).toHaveBeenCalledWith({
        status: null,
        page: undefined,
        limit: undefined,
      });
    });

    it('forwards use case errors to next', async () => {
      const error = new Error('db down');
      adminListSellerApplicationsUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.list({}, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('review', () => {
    it('responds with 200 and maps params, user and body', async () => {
      const result = { data: { id: APPLICATION_ID }, meta: {} };
      adminReviewSellerApplicationUseCase.execute.mockResolvedValue(result);

      const req = {
        user: { id: ADMIN_ID },
        params: { applicationId: APPLICATION_ID },
        body: { status: 'approved' },
      };
      const res = createMockResponse();

      await controller.review(req, res, vi.fn());

      expect(adminReviewSellerApplicationUseCase.execute).toHaveBeenCalledWith({
        applicationId: APPLICATION_ID,
        adminUserId: ADMIN_ID,
        status: 'approved',
        rejectionReason: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('prefers validated values and keeps the rejection reason', async () => {
      adminReviewSellerApplicationUseCase.execute.mockResolvedValue({ data: {}, meta: {} });

      await controller.review(
        {
          user: { id: ADMIN_ID },
          params: { applicationId: 'raw' },
          validatedParams: { applicationId: APPLICATION_ID },
          body: { status: 'raw' },
          validatedBody: { status: 'rejected', rejection_reason: 'Incomplete' },
        },
        createMockResponse(),
        vi.fn()
      );

      expect(adminReviewSellerApplicationUseCase.execute).toHaveBeenCalledWith({
        applicationId: APPLICATION_ID,
        adminUserId: ADMIN_ID,
        status: 'rejected',
        rejectionReason: 'Incomplete',
      });
    });

    it('tolerates missing params, body and user', async () => {
      adminReviewSellerApplicationUseCase.execute.mockResolvedValue({ data: {}, meta: {} });

      await controller.review({}, createMockResponse(), vi.fn());

      expect(adminReviewSellerApplicationUseCase.execute).toHaveBeenCalledWith({
        applicationId: undefined,
        adminUserId: undefined,
        status: undefined,
        rejectionReason: null,
      });
    });

    it('forwards use case errors to next', async () => {
      const error = new Error('not found');
      adminReviewSellerApplicationUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.review(
        {
          user: { id: ADMIN_ID },
          params: { applicationId: APPLICATION_ID },
          body: { status: 'approved' },
        },
        createMockResponse(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
