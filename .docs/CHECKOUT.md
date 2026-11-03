# Checkout (US-10) and Messaging

How `POST /v1/orders` turns a cart into an order and how the order event reaches the
notification consumer through RabbitMQ. Design rationale lives in the wiki
(`Architecture/ADR/ADR-014-Message-Broker`, `Architecture/Checkout-and-Messaging`); this page is
what the code actually does and how to run and test it.

## Flow

```text
POST /v1/orders  (cookie session + X-CSRF-Token)
  BEGIN
    SELECT cart lines JOIN products ... FOR UPDATE OF cart_items      -- 422 EMPTY_CART
    price the order (OrderPricingService)
    UPDATE products SET stock = stock - :qty
      WHERE id = :id AND stock >= :qty AND state = 'published' ...    -- 422 INSUFFICIENT_STOCK
      RETURNING stock                                                 --   (products in id order)
    INSERT orders + order_items (price/name snapshot)
    INSERT payments (status = 'pending', method = 'simulated')
    INSERT outbox_events (OrderPlaced, routing_key = order.placed)
    DELETE cart_items
  COMMIT        -- any error before this point rolls everything back, the cart is kept
  -> 201 { data: Order, meta }

(background, same process)
OutboxPublisher: BEGIN; SELECT ... FOR UPDATE SKIP LOCKED; publish + wait for broker confirm;
                 UPDATE status = 'published'; COMMIT          every OUTBOX_POLL_INTERVAL_MS
NotificationConsumer: qatu.notifications -> INSERT notifications ... ON CONFLICT (event_id) DO NOTHING -> ack
```

The request handler **never talks to RabbitMQ**. If the broker is down, checkout still returns
`201` and the event waits in `outbox_events`.

## Request

```json
{
  "shipping_address": {
    "full_name": "Aaron Florez",
    "phone": "71234567",
    "street": "Av. Arce #123",
    "city": "La Paz",
    "state": "La Paz",
    "country": "BO"
  },
  "payment_method": "simulated"
}
```

`full_name`, `phone`, `street`, `city` and `country` (2 letters) are required. `state`, `postal_code`
and `notes` are optional. `payment_method` is `simulated` (default, the "Tarjeta" option of the mockup)
or `cash_on_delivery`; the payment is always created `pending` and nothing is charged.

## Where things live

| Piece                                     | File                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Use case (the transaction)                | `application/use-cases/CreateOrderUseCase.js`                                                           |
| `OrderPricingService`, `InventoryService` | `domain/services/`                                                                                      |
| Business errors (422)                     | `domain/errors/CheckoutErrors.js`                                                                       |
| `OrderPlaced` event                       | `domain/events/OrderPlaced.js`                                                                          |
| Transaction port + Sequelize adapter      | `application/ports/ITransactionManager.js`, `infrastructure/persistence/SequelizeTransactionManager.js` |
| Outbox worker / consumer / lifecycle      | `infrastructure/messaging/`                                                                             |
| Migrations                                | `20261010000031-create-outbox-events.js`, `20261010000032-add-notifications-event-id.js`                |

## Pricing rule

Identical to the storefront cart (`client/src/store/cartStore.js`): shipping is **free from 50.00**,
otherwise a **flat 4.99**; no taxes yet. Amounts are computed in integer cents because the database
enforces `total = subtotal + shipping_cost + tax`. The server always reads prices from `products`;
the client never sends prices, quantities or a buyer id.

## Error contract

| Status | `error.code`            | When                                                                                                                      |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | Missing/invalid `shipping_address` or `notes` (> 500 chars)                                                               |
| 401    | `UNAUTHORIZED`          | No valid session                                                                                                          |
| 403    | `INVALID_CSRF_TOKEN`    | Cookie session without a matching `X-CSRF-Token` header                                                                   |
| 422    | `EMPTY_CART`            | Nothing to buy                                                                                                            |
| 422    | `INSUFFICIENT_STOCK`    | Not enough stock, including losing the race for the last unit. `details[0].field` is `items.<product_id>`                 |
| 422    | `PRODUCT_UNAVAILABLE`   | A product in the cart is no longer published                                                                              |
| 422    | `MIXED_CURRENCIES`      | Cart mixes currencies (an order has exactly one)                                                                          |
| 500    | `INTERNAL_SERVER_ERROR` | Database failure: the transaction is rolled back, the error is logged server-side, the client only sees a generic message |

## Running it locally

```bash
make docker-up          # Postgres + RabbitMQ
make db-migrate         # applies migrations 31 and 32 (after 29, the OAuth migration)
# .env (never committed): RABBITMQ_URL is already there; turn the worker on:
RABBITMQ_ENABLED=true
make dev
```

On startup the API logs `RabbitMQ connected; topology asserted`. The management UI is at
<http://localhost:15672>. Without `RABBITMQ_ENABLED=true` checkout works and events accumulate as
`pending` in `outbox_events` (they are delivered the next time the worker runs).

| Variable                        | Default                               | Notes                                                               |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `RABBITMQ_ENABLED`              | `false`                               | Only the exact string `true` enables the worker and consumer        |
| `RABBITMQ_URL`                  | local compose broker                  | Use `amqps://` in production; never commit a real URL               |
| `RABBITMQ_VHOST`                | _(none)_                              | Applied only if the URL has no vhost; use one vhost per environment |
| `RABBITMQ_EXCHANGE`             | `qatu.events`                         | topic, durable                                                      |
| `RABBITMQ_NOTIFICATIONS_QUEUE`  | `qatu.notifications`                  | durable, bound with `#`, dead-letters to the DLX                    |
| `RABBITMQ_DLX` / `RABBITMQ_DLQ` | `qatu.dlx` / `qatu.notifications.dlq` | fanout exchange + queue for poison messages                         |
| `OUTBOX_POLL_INTERVAL_MS`       | `2000`                                | 5000 recommended in production                                      |
| `OUTBOX_MAX_ATTEMPTS`           | `3`                                   | Then the event is marked `failed` (kept for inspection)             |

Inspect pending/failed events:

```sql
select id, event_type, status, attempts, last_error from outbox_events order by created_at desc;
```

## Tests

```bash
pnpm test                     # unit + integration (integration needs TEST_DATABASE_URL or Docker)
pnpm vitest run src/application/use-cases/__tests__/CreateOrderUseCase.integration.test.js
TEST_RABBITMQ_URL=amqp://qatu:qatu_dev_password@localhost:5672 \
  pnpm vitest run src/infrastructure/messaging/__tests__/OutboxToNotification.integration.test.js
```

- `CreateOrderUseCase.integration.test.js` runs the **real migrations** on a throw-away PostgreSQL
  database and covers: success, empty cart, insufficient stock with rollback, two buyers racing for the
  last unit (10 rounds), opposite cart order (no deadlock), same-buyer double submit, and a failure
  injected mid-transaction.
- `OutboxToNotification.integration.test.js` uses **real RabbitMQ** (`TEST_RABBITMQ_URL`, otherwise a
  Testcontainer) with unique topology names: happy path, idempotency, poison message to the DLQ,
  invalid event to the DLQ, ignored routing keys. It **skips itself** when no broker/Docker is available
  (the CI `test` job has no RabbitMQ service), so it never breaks the pipeline.

## Deviations from the wiki sketch (on purpose)

1. **Outbox claim, publish and update run in ONE transaction.** The sketch claimed rows with
   `SKIP LOCKED` in autocommit, which releases the lock immediately and makes `SKIP LOCKED` useless.
2. **Consumer retries use our own `x-retry-count` header.** `nack(requeue=true)` never increments
   `x-death`, so the sketch's "retry < 3" check would loop forever. A failed message is re-published to
   the same queue with the counter + 1 (original acked); after 3 attempts it is dead-lettered. Invalid
   payloads go to the DLQ immediately.
3. **Publisher confirms** (`createConfirmChannel`): an event is marked `published` only after the broker
   acked it, with a timeout.
4. **Idempotency by `INSERT ... ON CONFLICT DO NOTHING`** instead of "select then insert", which is
   race-free when two consumers handle the same event.
5. **Notification text is Spanish** (it is shown verbatim in the UI); API error messages stay English.

## Performance baseline

Measured once, locally (Docker Postgres 16, single API instance, development logging **on**, which
prints every SQL statement and slows it down): 50 sequential `POST /v1/orders`, 1 to 3 products each.

| Requests | Failures | p50     | p95      | max      |
| -------- | -------- | ------- | -------- | -------- |
| 50       | 0        | 66.4 ms | 138.1 ms | 184.0 ms |

Rate limit: 60 requests per minute per IP on `/v1/orders` (`app.js`).

## Known limits (MVP)

- The worker and consumer run inside the API process (ADR-014 "Evolution Path"); they should become a
  separate process before scaling horizontally.
- Only the buyer is notified for `order.placed`. Seller notifications need a per-recipient idempotency
  key (the unique index allows one notification per `event_id`).
- `outbox_events` is not archived.
- Payments are simulated: the row is created `pending` and nothing completes it yet.
