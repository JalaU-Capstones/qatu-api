# Admin reports (US-18)

Read-only aggregates for the admin dashboard. An admin calls three endpoints.
Nothing here creates, updates, or deletes a row.

## Endpoints

All three require an authenticated user whose roles, read from `user_roles`, include `admin`.
Cookie sessions send the cookies as usual. These routes are GET, so they do not need `X-CSRF-Token`.

| Endpoint                         | Query                                                       | What it returns                                      |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `GET /v1/admin/reports/sales`    | `from`, `to`, `group_by=day\|week\|month` (default `month`) | revenue, orders by period, top products, top sellers |
| `GET /v1/admin/reports/users`    | `from`, `to`                                                | buyers, sellers, pending applications, registrations |
| `GET /v1/admin/reports/products` | `from`, `to`                                                | published, draft, unpublished, top-selling products  |

`from` and `to` are inclusive calendar dates (`YYYY-MM-DD`). The range cannot exceed 366 days.
The server treats each date as a UTC day: `created_at >= from` and `created_at < to + 1 day`.

A missing or impossible date returns `400 VALIDATION_ERROR`. A signed-in user without the admin
role receives `403`. An anonymous caller receives `401`.

## What counts as a sale

Orders in `pending`, `confirmed`, `shipped`, or `delivered` are included.
`cancelled` and `refunded` are not.

Orders can use different currencies, so the API does not add BOB to USD.

- `total_orders` counts every included order.
- `revenue_by_currency` lists each currency on its own.
- `currency` is the one with the highest revenue. `total_revenue`, `period_breakdown`,
  `top_products`, and `top_sellers` use that currency.
- Seller revenue is the sum of that seller's line `subtotal`, not the order total
  (an order can mix sellers, shipping, and tax).
- `period_breakdown` is a continuous UTC series. Periods with no orders are returned as zeros.
  Weeks start on Monday, matching PostgreSQL `date_trunc('week', ...)`.

## Users

| Field                         | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `buyer_count`                 | profiles that currently have the `buyer` role          |
| `seller_count`                | profiles that currently have the `seller` role         |
| `pending_seller_applications` | applications whose status is `pending` right now       |
| `total_users`                 | profiles                                               |
| `new_registrations`           | profiles created inside the date range                 |
| `active_buyers`               | distinct buyers with a counted order in the range      |
| `active_sellers`              | distinct sellers with a counted line item in the range |

Registration assigns the buyer role and approving a seller adds the seller role on top,
so a seller is also counted in `buyer_count`.

## Products

State counts ignore soft-deleted products (`deleted_at` is not null):

- `published_products`, `draft_products`, `unpublished_products`, `archived_products`
- `total_products` is the sum of those four
- `new_listings` is products created inside the date range
- `top_selling_products` ranks by units sold in the range, across every currency
- `top_categories` and `top_rated_products` are a current snapshot, not filtered by the range

## Client

The page is `/admin/reports`. The header shows **Reportes** only when the signed-in user has the
admin role. The API still enforces that role on every request. A non-admin who opens the URL sees
a 403 view. An anonymous visitor is sent to login and returned to the page afterwards.
