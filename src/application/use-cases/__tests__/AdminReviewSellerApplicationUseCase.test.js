import { describe, expect, it, vi } from 'vitest';
import { SellerApplication } from '../../../domain/entities/SellerApplication.js';
import { AdminReviewSellerApplicationUseCase } from '../AdminReviewSellerApplicationUseCase.js';

const TRANSACTION = { id: 'tx-1' };

const application = (status = 'pending', overrides = {}) =>
  new SellerApplication({
    id: 'app-1',
    profileId: 'profile-1',
    businessName: 'Talleres Wara',
    businessDescription: 'Artisan textiles from Bolivia',
    status,
    ...overrides,
  });

const buildUseCase = ({ existing = application(), reviewed = application('approved') } = {}) => {
  const sellerApplicationRepository = {
    findById: vi.fn().mockResolvedValue(existing),
    review: vi.fn().mockImplementation(async () => reviewed),
  };
  const profileRepository = { assignRole: vi.fn().mockResolvedValue(undefined) };
  const outboxRepository = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const transactionManager = { run: vi.fn(async (work) => work(TRANSACTION)) };

  return {
    sellerApplicationRepository,
    profileRepository,
    outboxRepository,
    transactionManager,
    useCase: new AdminReviewSellerApplicationUseCase({
      sellerApplicationRepository,
      profileRepository,
      outboxRepository,
      transactionManager,
    }),
  };
};

const command = (status = 'approved') => ({
  applicationId: 'app-1',
  adminUserId: 'admin-1',
  status,
});

describe('AdminReviewSellerApplicationUseCase', () => {
  it.each([
    [
      'sellerApplicationRepository',
      { profileRepository: {}, outboxRepository: {}, transactionManager: {} },
    ],
    [
      'profileRepository',
      { sellerApplicationRepository: {}, outboxRepository: {}, transactionManager: {} },
    ],
    [
      'outboxRepository',
      { sellerApplicationRepository: {}, profileRepository: {}, transactionManager: {} },
    ],
    [
      'transactionManager',
      { sellerApplicationRepository: {}, profileRepository: {}, outboxRepository: {} },
    ],
  ])('requires %s', (dependency, present) => {
    expect(() => new AdminReviewSellerApplicationUseCase(present)).toThrow(
      `${dependency} is required`
    );
  });

  it('throws a 404 NOT_FOUND when the application does not exist', async () => {
    const { transactionManager, useCase } = buildUseCase({ existing: null });

    await expect(useCase.execute(command())).rejects.toMatchObject({
      message: 'Seller application not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(transactionManager.run).not.toHaveBeenCalled();
  });

  it('throws a 422 ALREADY_REVIEWED when the application is not pending', async () => {
    const { transactionManager, useCase } = buildUseCase({ existing: application('approved') });

    await expect(useCase.execute(command())).rejects.toMatchObject({
      message: 'This application has already been reviewed.',
      code: 'ALREADY_REVIEWED',
      statusCode: 422,
    });
    expect(transactionManager.run).not.toHaveBeenCalled();
  });

  it('approves inside a transaction, assigns the seller role and enqueues an approved event', async () => {
    const deps = buildUseCase({ reviewed: application('approved') });

    const response = await deps.useCase.execute(command('approved'));

    expect(deps.sellerApplicationRepository.findById).toHaveBeenCalledWith('app-1');
    expect(deps.transactionManager.run).toHaveBeenCalledOnce();
    expect(deps.sellerApplicationRepository.review).toHaveBeenCalledWith(
      {
        id: 'app-1',
        status: 'approved',
        reviewedBy: 'admin-1',
        rejectionReason: null,
      },
      { transaction: TRANSACTION }
    );
    expect(deps.profileRepository.assignRole).toHaveBeenCalledWith('profile-1', 'seller', {
      assignedBy: 'admin-1',
      transaction: TRANSACTION,
    });
    expect(deps.outboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SellerApproved',
        routingKey: 'seller_application.approved',
        payload: {
          application_id: 'app-1',
          profile_id: 'profile-1',
          reviewed_by: 'admin-1',
        },
      }),
      { transaction: TRANSACTION }
    );
    expect(response.data).toMatchObject({ id: 'app-1', status: 'approved' });
  });

  it('rejects inside a transaction and enqueues a rejected event with the reason', async () => {
    const deps = buildUseCase({
      reviewed: application('rejected', { rejectionReason: 'Datos incompletos' }),
    });

    const response = await deps.useCase.execute({
      ...command('rejected'),
      rejectionReason: 'Datos incompletos',
    });

    expect(deps.sellerApplicationRepository.review).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Datos incompletos',
      }),
      { transaction: TRANSACTION }
    );
    expect(deps.profileRepository.assignRole).not.toHaveBeenCalled();
    expect(deps.outboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SellerRejected',
        routingKey: 'seller_application.rejected',
        payload: {
          application_id: 'app-1',
          profile_id: 'profile-1',
          reviewed_by: 'admin-1',
          rejection_reason: 'Datos incompletos',
        },
      }),
      { transaction: TRANSACTION }
    );
    expect(response.data).toMatchObject({ id: 'app-1', status: 'rejected' });
  });

  it('defaults the rejection reason to null when rejecting without one', async () => {
    const deps = buildUseCase({ reviewed: application('rejected') });

    await deps.useCase.execute(command('rejected'));

    expect(deps.sellerApplicationRepository.review).toHaveBeenCalledWith(
      expect.objectContaining({ rejectionReason: null }),
      { transaction: TRANSACTION }
    );
    expect(deps.outboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ rejection_reason: null }),
      }),
      { transaction: TRANSACTION }
    );
  });

  it('throws a 422 when the concurrent review returns no entity', async () => {
    const deps = buildUseCase({ reviewed: null });

    await expect(deps.useCase.execute(command())).rejects.toMatchObject({
      message: 'This application has already been reviewed.',
      code: 'ALREADY_REVIEWED',
      statusCode: 422,
    });
    expect(deps.profileRepository.assignRole).not.toHaveBeenCalled();
    expect(deps.outboxRepository.enqueue).not.toHaveBeenCalled();
  });
});
