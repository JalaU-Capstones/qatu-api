# Troubleshooting

- **Docker:** If ports conflict, ensure no other Postgres or RabbitMQ is running.
- **pnpm:** Clear cache with `pnpm store prune`.
- **Node.js:** Ensure Node v26+ is used.
- **Environment:** Run `make docker:down -v` to reset data volumes.
