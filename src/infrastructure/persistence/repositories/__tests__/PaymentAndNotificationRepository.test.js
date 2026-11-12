import { QueryTypes } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INotificationRepository } from '../../../../domain/repositories/INotificationRepository.js';
import { IPaymentRepository } from '../../../../domain/repositories/IPaymentRepository.js';
import { NotificationRepository } from '../NotificationRepository.js';
import { PaymentRepository } from '../PaymentRepository.js';

describe('PaymentRepository', () => {
  let mockDb;
  let repository;

  beforeEach(() => {
    mockDb = { query: vi.fn() };
    repository = new PaymentRepository({ db: mockDb });
  });

  it('is an IPaymentRepository', () => {
    expect(repository).toBeInstanceOf(IPaymentRepository);
    expect(() => new IPaymentRepository()).toThrow('cannot be instantiated');
  });

  it('creates a pending, simulated payment inside the given transaction', async () => {
    mockDb.query.mockResolvedValueOnce([
      {
        id: 'pay-1',
        order_id: 'order-1',
        amount: '44.99',
        currency: 'USD',
        method: 'simulated',
        status: 'pending',
      },
    ]);
    const transaction = { id: 'tx' };

    const payment = await repository.createPending(
      { orderId: 'order-1', amount: 44.99, currency: 'USD' },
      { transaction }
    );

    expect(payment).toEqual({
      id: 'pay-1',
      order_id: 'order-1',
      amount: 44.99,
      currency: 'USD',
      method: 'simulated',
      status: 'pending',
    });
    const [sql, options] = mockDb.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.payments');
    expect(sql).toContain("'pending'");
    expect(options).toMatchObject({
      replacements: { orderId: 'order-1', amount: 44.99, currency: 'USD', method: 'simulated' },
      type: QueryTypes.SELECT,
      transaction,
    });
  });

  it('throws when no row is returned', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await expect(
      repository.createPending({ orderId: 'o', amount: 1, currency: 'USD' })
    ).rejects.toThrow('no row returned');
  });
});

describe('NotificationRepository', () => {
  let mockDb;
  let repository;

  const event = {
    eventId: 'evt-1',
    profileId: 'buyer-1',
    type: 'order_placed',
    title: 'Pedido realizado',
    body: 'body',
    actionUrl: '/orders',
    payload: { order_id: 'o' },
  };

  beforeEach(() => {
    mockDb = { query: vi.fn() };
    repository = new NotificationRepository({ db: mockDb });
  });

  it('is an INotificationRepository', () => {
    expect(repository).toBeInstanceOf(INotificationRepository);
    expect(() => new INotificationRepository()).toThrow('cannot be instantiated');
  });

  it('inserts with ON CONFLICT DO NOTHING on the partial unique event_id index', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 'n-1' }]);

    const inserted = await repository.createFromEvent(event);

    expect(inserted).toBe(true);
    const [sql, options] = mockDb.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING');
    expect(options.replacements).toMatchObject({
      eventId: 'evt-1',
      profileId: 'buyer-1',
      payload: '{"order_id":"o"}',
    });
  });

  it('returns false when the event was already processed (duplicate delivery)', async () => {
    mockDb.query.mockResolvedValueOnce([]);

    await expect(repository.createFromEvent(event)).resolves.toBe(false);
  });
});
