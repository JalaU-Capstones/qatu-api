# Seller Orders & Status Updates (US-12 / US-13)

Sellers see the orders that contain their products and advance a shared order status through a
fixed state machine. The buyer is notified on every change. Design rationale lives in the wiki
(`Architecture/ADR/ADR-017`, `Spikes/SP-17`); this page is what the code actually does.

## Endpoints

All endpoints live under `/v1/orders` (there are no seller-specific API routes: the scope is chosen
with the `view` query parameter). `/seller/orders` is a **client** (SPA) route, not an API route.

| Endpoint                        | Who                                                  | Result                                                      |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/orders` (`view=buyer`) | any authenticated user (default)                     | orders the user placed                                      |
| `GET /v1/orders?view=seller`    | `seller` or `admin` role                             | orders with ≥1 of the caller's products, **own items only** |
| `GET /v1/orders?view=admin`     | `admin` role                                         | all orders                                                  |
| `GET /v1/orders/:id`            | buyer of the order, seller with ≥1 item on it, admin | buyer/admin: full order. seller: own `items[]` only         |
| `PATCH /v1/orders/:id/status`   | see [rules](#status-transition-rules)                | updated order (seller: own `items[]` only)                  |

`PATCH` body: `{ "status": "confirmed" | "shipped" | "delivered" | "cancelled" }`. Cookie sessions
must send the `X-CSRF-Token` header (ADR-012); Bearer requests are exempt.

Order **totals** (`subtotal`, `shipping_cost`, `tax`, `total`) are always the full-order values from
checkout, even when a seller only sees their own `items[]`. A seller dashboard must compute its own
revenue from the sum of `items[].subtotal`.

## Where roles come from

Roles are resolved **server-side from `user_roles`** (`ProfileRepository.findById`) in every use
case. The client can never assert a role:

- Nothing in the request (query, body, headers) is read as a role.
- `req.user.role` is derived from Supabase `user_metadata`, which the end user can edit, so it is
  **informational only** and is not passed to the order use cases.
- If no profile repository is wired, nobody has elevated roles (fail closed).

Requesting a `view` the roles do not allow returns `403`.

## Status transition rules

| From             | To               | Actor  |
| ---------------- | ---------------- | ------ |
| `pending`        | `confirmed`      | seller |
| `confirmed`      | `shipped`        | seller |
| `shipped`        | `delivered`      | seller |
| `confirmed`      | `cancelled`      | seller |
| `pending`        | `cancelled`      | buyer  |
| any non-terminal | any other status | admin  |

- `delivered` and `cancelled` are **terminal**: no actor, admin included, can change them.
- A **seller** is only accepted if they own at least one line item on that order
  (`sellerHasItemsOnOrder`); otherwise `403`. Owning no items is never enough, even if the order exists.
- The **buyer** must be the order's buyer.
- A seller who is also the order's buyer acts as seller.

Errors: `404 NOT_FOUND` (no such order), `403 FORBIDDEN` (order exists, action not allowed for this
user), `422 INVALID_STATUS_TRANSITION` (transition not allowed, including any change from a terminal state).

## Multi-seller orders

- There is **one** status per order (no per-item status in the MVP, ADR-017).
- Any seller with ≥1 line item may advance the shared status.
- Each seller sees only their own `items[]`, in the list, the detail and the `PATCH` response.
  The filter is applied in SQL (`order_items` joined to `products.seller_id`), so other sellers'
  lines are never loaded for that response.

## Notifications

- `PATCH` updates the order and enqueues `OrderStatusChanged` (`order.status_changed`) in the
  **same transaction** (transactional outbox, ADR-014). The API never talks to the broker.
- The payload is PII-free: `order_id`, `order_number`, `from_status`, `to_status`, `buyer_id`,
  `changed_by`. No email, name, address, phone or notes.
- `CreateNotificationFromEventUseCase` creates the buyer's notification, idempotent on `eventId`,
  with the Spanish status label (`pendiente`, `confirmado`, `enviado`, `entregado`, `cancelado`).

## Known limitation

The current status is read, validated and then updated without re-checking it in the `UPDATE`.
Two conflicting requests at the same instant (for example a buyer cancelling while a seller
confirms the same `pending` order) are both validated against `pending`; the last write wins and two
events are emitted. A guarded update (`WHERE status = :expected`, answering `409` on mismatch) would
close it.

## Tests

`pnpm test` covers the transition matrix, ownership, terminal states for every actor, role trust,
seller-scoped items (repository SQL and use cases) and the PII-free event payload. To exercise the
flow by hand see [`TEST-SELLER-SETUP.md`](./TEST-SELLER-SETUP.md).
