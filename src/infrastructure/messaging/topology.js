/**
 * Declares the ADR-014 topology (idempotent; throws if an existing one drifted):
 * qatu.events (topic) → qatu.notifications → dead letter → qatu.dlx (fanout) → qatu.notifications.dlq
 */
export async function assertTopology(channel, { exchange, notificationsQueue, dlx, dlq }) {
  await channel.assertExchange(exchange, 'topic', { durable: true });

  await channel.assertExchange(dlx, 'fanout', { durable: true });
  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, dlx, '');

  await channel.assertQueue(notificationsQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': dlx,
      'x-dead-letter-routing-key': 'notifications.dlq',
    },
  });
  await channel.bindQueue(notificationsQueue, exchange, '#');
}
