import { describe, expect, it, vi } from 'vitest';
import { createMessagingService } from '../createMessagingService.js';

const mocks = vi.hoisted(() => {
  const env = {
    RABBITMQ_URL: 'amqp://default',
    RABBITMQ_VHOST: 'default-vhost',
    RABBITMQ_EXCHANGE: 'default-exchange',
    RABBITMQ_NOTIFICATIONS_QUEUE: 'default-queue',
    RABBITMQ_DLX: 'default-dlx',
    RABBITMQ_DLQ: 'default-dlq',
    OUTBOX_POLL_INTERVAL_MS: 1000,
    OUTBOX_MAX_ATTEMPTS: 5,
  };
  return {
    env,
    outboxPublisherInstance: { id: 'publisher' },
    notificationConsumerInstance: { id: 'consumer' },
    messagingServiceInstance: { id: 'service' },
    useCaseInstance: { id: 'use-case' },
    OutboxPublisher: vi.fn(function () {
      return mocks.outboxPublisherInstance;
    }),
    NotificationConsumer: vi.fn(function () {
      return mocks.notificationConsumerInstance;
    }),
    MessagingService: vi.fn(function () {
      return mocks.messagingServiceInstance;
    }),
    CreateNotificationFromEventUseCase: vi.fn(function () {
      return mocks.useCaseInstance;
    }),
    SequelizeTransactionManager: vi.fn(function () {
      return { id: 'transaction-manager' };
    }),
    NotificationRepository: vi.fn(function () {
      return { id: 'notification-repository' };
    }),
    OutboxRepository: vi.fn(function () {
      return { id: 'outbox-repository' };
    }),
  };
});

vi.mock('../../config/env.js', () => ({ env: mocks.env }));
vi.mock('../../persistence/SequelizeTransactionManager.js', () => ({
  SequelizeTransactionManager: mocks.SequelizeTransactionManager,
}));
vi.mock('../../persistence/repositories/NotificationRepository.js', () => ({
  NotificationRepository: mocks.NotificationRepository,
}));
vi.mock('../../persistence/repositories/OutboxRepository.js', () => ({
  OutboxRepository: mocks.OutboxRepository,
}));
vi.mock('../../../application/use-cases/CreateNotificationFromEventUseCase.js', () => ({
  CreateNotificationFromEventUseCase: mocks.CreateNotificationFromEventUseCase,
}));
vi.mock('../OutboxPublisher.js', () => ({ OutboxPublisher: mocks.OutboxPublisher }));
vi.mock('../NotificationConsumer.js', () => ({
  NotificationConsumer: mocks.NotificationConsumer,
}));
vi.mock('../MessagingService.js', () => ({ MessagingService: mocks.MessagingService }));

describe('createMessagingService', () => {
  const config = {
    RABBITMQ_URL: 'amqp://custom',
    RABBITMQ_VHOST: 'custom-vhost',
    RABBITMQ_EXCHANGE: 'custom-exchange',
    RABBITMQ_NOTIFICATIONS_QUEUE: 'custom-queue',
    RABBITMQ_DLX: 'custom-dlx',
    RABBITMQ_DLQ: 'custom-dlq',
    OUTBOX_POLL_INTERVAL_MS: 250,
    OUTBOX_MAX_ATTEMPTS: 3,
  };

  it('wires the real repositories and consumers using env by default', () => {
    expect(createMessagingService()).toBe(mocks.messagingServiceInstance);

    expect(mocks.OutboxPublisher).toHaveBeenCalledWith({
      outboxRepository: { id: 'outbox-repository' },
      transactionManager: { id: 'transaction-manager' },
      exchange: mocks.env.RABBITMQ_EXCHANGE,
      intervalMs: mocks.env.OUTBOX_POLL_INTERVAL_MS,
      maxAttempts: mocks.env.OUTBOX_MAX_ATTEMPTS,
    });
    expect(mocks.CreateNotificationFromEventUseCase).toHaveBeenCalledWith({
      notificationRepository: { id: 'notification-repository' },
    });
    expect(mocks.NotificationConsumer).toHaveBeenCalledWith({
      createNotificationFromEventUseCase: mocks.useCaseInstance,
      queue: mocks.env.RABBITMQ_NOTIFICATIONS_QUEUE,
    });
    expect(mocks.MessagingService).toHaveBeenCalledWith({
      url: mocks.env.RABBITMQ_URL,
      vhost: mocks.env.RABBITMQ_VHOST,
      topology: {
        exchange: mocks.env.RABBITMQ_EXCHANGE,
        notificationsQueue: mocks.env.RABBITMQ_NOTIFICATIONS_QUEUE,
        dlx: mocks.env.RABBITMQ_DLX,
        dlq: mocks.env.RABBITMQ_DLQ,
      },
      outboxPublisher: mocks.outboxPublisherInstance,
      notificationConsumer: mocks.notificationConsumerInstance,
    });
  });

  it('accepts an explicit configuration', () => {
    expect(createMessagingService(config)).toBe(mocks.messagingServiceInstance);
    expect(mocks.OutboxPublisher).toHaveBeenLastCalledWith(
      expect.objectContaining({
        exchange: config.RABBITMQ_EXCHANGE,
        intervalMs: config.OUTBOX_POLL_INTERVAL_MS,
        maxAttempts: config.OUTBOX_MAX_ATTEMPTS,
      })
    );
    expect(mocks.MessagingService.mock.calls.at(-1)[0]).toMatchObject({
      url: config.RABBITMQ_URL,
      vhost: config.RABBITMQ_VHOST,
      topology: {
        exchange: config.RABBITMQ_EXCHANGE,
        notificationsQueue: config.RABBITMQ_NOTIFICATIONS_QUEUE,
        dlx: config.RABBITMQ_DLX,
        dlq: config.RABBITMQ_DLQ,
      },
    });
  });
});
