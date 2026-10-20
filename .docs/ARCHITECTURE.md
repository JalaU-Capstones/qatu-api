# Qatu Marketplace Backend Architecture

## 1.1 Overview

Qatu Marketplace follows the **Onion Architecture** pattern. This architecture ensures that the core domain logic remains independent of external frameworks, databases, and user interfaces. By keeping the domain isolated, we achieve a highly testable, maintainable, and scalable system.

For architectural decisions, please refer to [ADR-005 (Backend Architecture)](#) and the [Wiki](#).

## 1.2 Layers (Detailed)

### Domain Layer

- **Purpose:** Contains the core business logic, entities, and rules of the application. It is the heart of the system.
- **Components:** Entities (e.g., `Product`, `Profile`), Value Objects, Domain Events, and Repository Interfaces (e.g., `IProductRepository`, `IProfileRepository`).
- **Dependencies:** None. It does not depend on any outer layers.
- **What does NOT belong here:** Express.js code, database queries, ORM models, or infrastructure concerns.

### Application Layer

- **Purpose:** Orchestrates business use cases. It directs the flow of data to and from the domain layer.
- **Components:** Use Cases (Interactors, e.g., `ListProductsUseCase`, `RegisterBuyerUseCase`, `LoginUseCase`), DTOs (Data Transfer Objects), and Application Interfaces.
- **Dependencies:** Depends ONLY on the Domain layer.
- **What does NOT belong here:** HTTP routing, API requests, database implementations.

### Infrastructure Layer

- **Purpose:** Provides implementations for interfaces defined in the inner layers (e.g., repositories). Handles communication with external systems.
- **Components:** Database Implementations (Sequelize), Message Brokers (RabbitMQ), External APIs, Authentication mechanisms (Supabase Auth).
- **Dependencies:** Depends on the Application and Domain layers.
- **What does NOT belong here:** Core business rules.

#### Persistence

- **Repositories:** `ProfileRepository`, `ProductRepository`, `CategoryRepository`.

> **Note:** `ProductRepository.findAll` explicitly filters `state = 'published' AND deleted_at IS NULL` in SQL. It does **not** rely on the RLS policy `"Published products are publicly readable"` because the backend connects with the `qatu` DB user, which is the table owner and bypasses RLS by default. RLS remains active for end-user access via Supabase.

#### Catalog search and filters (US-05 / US-06)

`GET /v1/products` accepts `search`, `category_id`, `min_price`, `max_price`, `seller_id`, `sort_by`, `sort_order`, `page` and `limit`. All filters are combined with `AND` and every value is passed as a bound parameter (never concatenated), except the `ORDER BY` column, which comes from a fixed whitelist.

- **Keyword search** matches the product `name` and `description` and is case-insensitive. It combines two strategies inside one parenthesised condition:
  - Full-text (`search_vector @@ plainto_tsquery('simple', ...)`) for multi-word terms in any order.
  - `ILIKE '%term%'` for partial words, so `phone` finds "Smartphone" and "Headphones". The term is escaped with `escapeLikePattern`, so `%`, `_` and `\` are matched literally.
- **Indexes:** the full-text GIN index (`idx_products_search`) and the trigram GIN indexes created by migration 27 (`idx_products_name_trgm`, `idx_products_description_trgm`) let PostgreSQL resolve the whole `OR` with a `BitmapOr` instead of scanning the table. `category_id` and `price` already have their own indexes.
- **Validation:** `max_price` must be greater than or equal to `min_price` (otherwise `400 VALIDATION_ERROR` on `max_price`). An empty result is a normal `200` with `data: []`, `meta.total: 0` and `meta.total_pages: 0`.
- **Categories:** `GET /v1/categories` lists active categories ordered by `position` and `name` so clients can build the category filter. The total is counted in a separate query, so it stays correct for out-of-range pages.

### Presentation Layer

- **Purpose:** Acts as the entry point for the application. Handles HTTP requests and responses.
- **Components:** Express.js Controllers, Routes, Middleware, Request Validation (Joi).
- **Dependencies:** Depends on the Application and Infrastructure layers.
- **What does NOT belong here:** Business logic or direct database queries.

## 1.3 Dependency Rule

The overriding rule of Onion Architecture is that **dependencies point inward**. Inner layers do not know anything about outer layers.

```mermaid
graph TD
    Presentation[Presentation Layer]
    Infrastructure[Infrastructure Layer]
    Application[Application Layer]
    Domain[Domain Layer]

    Presentation --> Application
    Infrastructure --> Application
    Application --> Domain
```

Dependency Inversion is applied heavily. When an Application Use Case needs to fetch data, it relies on a Repository Interface defined in the Domain/Application layer, while the actual implementation lives in the Infrastructure layer.

## 1.4 Folder Structure

```text
src/
├── domain/               # Core business logic
│   ├── entities/         # Domain entities (e.g., Product.js, User.js)
│   ├── valueObjects/     # Immutable value objects
│   └── repositories/     # Repository interfaces
├── application/          # Use cases and DTOs
│   ├── useCases/         # e.g., PlaceOrderUseCase.js
│   └── dtos/             # Data Transfer Objects
├── infrastructure/       # External system implementations
│   ├── database/         # Sequelize configurations and models
│   ├── repositories/     # Implementations (e.g., UserRepository.js)
│   ├── messaging/        # RabbitMQ publishers/consumers
│   └── auth/             # Supabase Auth integrations
└── presentation/         # HTTP and UI
    ├── controllers/      # Express controllers
    ├── routes/           # Express routes
    ├── middlewares/      # Express middlewares
    ├── validators/       # Joi schemas
    └── docs/             # OpenAPI 3.1 specification & Swagger UI
```

Files use PascalCase for classes (e.g., `PlaceOrderUseCase.js`, `UserRepository.js`).

## 1.5 Cross-Cutting Concerns

- **Authentication:** Handled via Supabase Auth in the Infrastructure layer. A custom middleware in the Presentation layer verifies the JWT token.
- **Authorization:** Enforced at the database level using PostgreSQL Row Level Security (RLS). Policies are established in migrations.
- **Validation:** Conducted in the Presentation layer using Joi schemas before requests reach the Application layer.
- **API Specification:** Modular OpenAPI 3.1.0 contract maintained in `src/presentation/docs/` as the single source of truth; served via Swagger UI at `/api-docs`.
- **Logging:** Centralized using Pino across all layers for consistent and performant logging.
- **Messaging:** Treated as an infrastructure concern using RabbitMQ. Publishers and consumers live in the Infrastructure layer.
- **Error Handling:** Errors propagate from the Domain layer outwards, mapped to corresponding HTTP status codes in a global error handling middleware in the Presentation layer.

## 1.6 Testing Strategy per Layer

- **Domain:** Pure unit tests, no mocks needed.
- **Application:** Unit tests with mocked repositories.
- **Infrastructure:** Integration tests with Testcontainers (real PostgreSQL, RabbitMQ).
- **Presentation:** Integration tests with Supertest.

## 1.7 Architecture Decision Records

- ADR-001: Use Node.js for Backend (Link to Wiki)
- ADR-002: Use Express.js Framework (Link to Wiki)
- ADR-003: Use Supabase for Authentication (Link to Wiki)
- ADR-004: PostgreSQL as Primary Database (Link to Wiki)
- ADR-005: Backend Onion Architecture (Link to Wiki)
- ADR-006: RabbitMQ for Asynchronous Messaging (Link to Wiki)
- ADR-007: Testcontainers for Integration Tests (Link to Wiki)
- ADR-008: OpenAPI for API Documentation (Link to Wiki)

## 1.8 References

- [OpenAPI Specification](OPENAPI.md)
- [Wiki: Architecture/Overview](#)
- [Wiki: Architecture/Backend](#)
- [Wiki: Architecture/Data-Model](#)
- [Wiki: Architecture/Security](#)
- [Wiki: Architecture/API-Design](#)

### Migrations

Migrations are versioned in `src/infrastructure/persistence/migrations/` and run via Sequelize CLI. The order is defined by the filename timestamp prefix. Every migration:

- Creates one logical unit (a table, a group of related triggers, or a set of seed data).
- Wraps statements in a transaction.
- Includes a working `down` step.
- Enables RLS and adds policies for every table.
- Uses `IF NOT EXISTS` / `IF EXISTS` for idempotency.

Seeders live in `src/infrastructure/persistence/seeders/` and are idempotent. They populate roles, categories, and the admin user for development and staging.

See [`.docs/MIGRATIONS.md`](MIGRATIONS.md) for the full guide.
