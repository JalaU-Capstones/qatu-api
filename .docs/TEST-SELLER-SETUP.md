# Test Seller Setup

How to get a seller account that can log in and exercise US-12 / US-13 by hand
(see [`SELLER-ORDERS.md`](./SELLER-ORDERS.md)). Development and staging only.

## What the seeder creates (and what it does not)

`20261010000026-seed-sample-products.js` inserts a **catalog owner**, not a login:

| Field    | Value                                                         |
| -------- | ------------------------------------------------------------- |
| Email    | `seller@example.qatu.pe`                                      |
| Username | `sample_seller`                                               |
| Id       | `00000000-0000-0000-0000-000000000002`                        |
| Data     | role `seller` + 25 published products (`seller_id` = that id) |

- The email uses a routable-looking domain on purpose. Supabase Auth rejects non-routable domains
  such as `.local`, so the previous `seller@qatu.local` could not sign in or reset its password.
  Re-running `make db-seed` also migrates databases seeded with the old email.
- The seeder inserts the `auth.users` row **without a password**. Do not rely on it for login.
  Products belong to that id, **not** to an email, so a freshly registered user does not own them.
- `admin@qatu.local` (admin seeder) has the same non-routable-domain problem and is unchanged.

## Create a seller that can log in

1. Register a normal account (client sign-up, or `POST /v1/auth/register`) with an email you control.
2. Grant it the `seller` role (note `user_roles` uses `profile_id`; `profiles.id` = `auth.users.id`):

   ```sql
   INSERT INTO public.user_roles (profile_id, role_id)
   SELECT p.id, r.id
   FROM public.profiles p, public.roles r
   WHERE p.email = '<your-email>' AND r.name = 'seller'
   ON CONFLICT (profile_id, role_id) DO NOTHING;
   ```

3. Give it products to sell, by moving some sample products to it:

   ```sql
   UPDATE public.products
   SET seller_id = (SELECT id FROM public.profiles WHERE email = '<your-email>')
   WHERE slug IN ('wireless-noise-canceling-headphones', 'ultra-slim-mechanical-keyboard');
   ```

4. Log out and in again, so the session is fresh.

The role is read from `user_roles` on every request, so no token or metadata change is needed.

## Verify the flow

1. As a **different buyer**, add those products to the cart and check out (`POST /v1/orders`).
2. As the seller, open `/seller/orders` (or `GET /v1/orders?view=seller`): only orders with the
   seller's products appear, and `items[]` holds only the seller's lines.
3. Advance the status: `pending → confirmed → shipped → delivered` (`PATCH /v1/orders/:id/status`,
   with `X-CSRF-Token` for cookie sessions). A further change from `delivered` must return `422`.
4. As the buyer, `GET /v1/notifications`: one notification per change, e.g.
   `Tu pedido ORD-… ahora está enviado.` (needs RabbitMQ and the outbox publisher running, see
   [`CHECKOUT.md`](./CHECKOUT.md)).

### Check that sellers cannot see each other's items

1. Make a second seller (steps 1-2 above, other email) and move a different product to them.
2. As the buyer, put one product from each seller in a single order.
3. Each seller must see that order with **only their own** line, and the same order `total`.
4. Seller B calling `PATCH /v1/orders/:id/status` on an order that has none of their products must
   get `403`.
