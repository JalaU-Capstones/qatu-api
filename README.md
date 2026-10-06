# Qatu Marketplace Backend API

![CI Status](https://github.com/JalaU-Capstones/qatu-api/actions/workflows/ci.yml/badge.svg)

Qatu (Quechua word for "store") is an online digital marketplace where sellers can offer products to buyers.

## Tech Stack

- **Language:** JavaScript (Node.js)
- **Framework:** Express.js
- **Architecture:** Onion Architecture
- **Database:** PostgreSQL (Sequelize ORM)
- **Authentication:** Supabase Auth
- **Messaging:** RabbitMQ
- **Testing:** Vitest, Supertest, Testcontainers

## Prerequisites

- Node.js v26.x
- pnpm v11.x
- Docker and Docker Compose

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone git@github.com:JalaU-Capstones/qatu-api.git
   cd qatu-api
   ```

2. **Install dependencies:**

   ```bash
   make install
   ```

3. **Environment Setup:**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with appropriate values.

4. **Start Infrastructure:**

   ```bash
   make docker:up
   ```

5. **Run Migrations:**

   ```bash
   make db:migrate
   ```

6. **Start Development Server:**
   ```bash
   make dev
   ```

## Available Scripts

Check the `Makefile` for available commands by running:

```bash
make help
```

## Documentation

- [Architecture](.docs/ARCHITECTURE.md)
- [Troubleshooting](.docs/TROUBLESHOOTING.md)
- [Git Rules](.docs/GIT_RULES.md)

## License

MIT License
