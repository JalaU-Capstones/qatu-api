import { app } from './app.js';
import { env } from './infrastructure/config/env.js';
import { logger } from './infrastructure/logging/logger.js';
import { createMessagingService } from './infrastructure/messaging/createMessagingService.js';

const port = env.PORT || 3000;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

// The outbox worker and notification consumer run in-process and connect in the background,
// so an unreachable broker never blocks startup or checkout.
let messaging = null;
if (env.RABBITMQ_ENABLED) {
  messaging = createMessagingService(env);
  app.locals.messaging = messaging;
  void messaging.start();
} else {
  logger.info('RabbitMQ messaging disabled (set RABBITMQ_ENABLED=true to enable it)');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await messaging?.stop();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
