import { CreateNotificationFromEventUseCase } from '../../application/use-cases/CreateNotificationFromEventUseCase.js';
import { env } from '../config/env.js';
import { SequelizeTransactionManager } from '../persistence/SequelizeTransactionManager.js';
import { NotificationRepository } from '../persistence/repositories/NotificationRepository.js';
import { OutboxRepository } from '../persistence/repositories/OutboxRepository.js';
import { MessagingService } from './MessagingService.js';
import { NotificationConsumer } from './NotificationConsumer.js';
import { OutboxPublisher } from './OutboxPublisher.js';

/** Wires the outbox worker and the notification consumer with their real repositories. */
export function createMessagingService(config = env) {
  const outboxPublisher = new OutboxPublisher({
    outboxRepository: new OutboxRepository(),
    transactionManager: new SequelizeTransactionManager(),
    exchange: config.RABBITMQ_EXCHANGE,
    intervalMs: config.OUTBOX_POLL_INTERVAL_MS,
    maxAttempts: config.OUTBOX_MAX_ATTEMPTS,
  });

  const notificationConsumer = new NotificationConsumer({
    createNotificationFromEventUseCase: new CreateNotificationFromEventUseCase({
      notificationRepository: new NotificationRepository(),
    }),
    queue: config.RABBITMQ_NOTIFICATIONS_QUEUE,
  });

  return new MessagingService({
    url: config.RABBITMQ_URL,
    vhost: config.RABBITMQ_VHOST,
    topology: {
      exchange: config.RABBITMQ_EXCHANGE,
      notificationsQueue: config.RABBITMQ_NOTIFICATIONS_QUEUE,
      dlx: config.RABBITMQ_DLX,
      dlq: config.RABBITMQ_DLQ,
    },
    outboxPublisher,
    notificationConsumer,
  });
}
