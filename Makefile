SHELL := /bin/bash

.PHONY: help install dev start lint lint-fix format format-check test test-watch test-coverage test-integration build docker-up docker-down docker-logs db-migrate db-migrate-undo db-seed clean

help:
	@echo "Qatu API - Available targets:"
	@echo "  install            Install dependencies with pnpm"
	@echo "  dev                Start development server with nodemon"
	@echo "  start              Start production server"
	@echo "  lint               Run ESLint"
	@echo "  lint-fix           Run ESLint with auto-fix"
	@echo "  format             Run Prettier"
	@echo "  format-check       Check formatting with Prettier"
	@echo "  test               Run unit tests"
	@echo "  test-watch         Run tests in watch mode"
	@echo "  test-coverage      Run tests with coverage"
	@echo "  test-integration   Run integration tests (requires Docker)"
	@echo "  docker-up          Start Docker Compose infrastructure"
	@echo "  docker-down        Stop Docker Compose"
	@echo "  docker-logs        View Docker Compose logs"
	@echo "  db-migrate         Run Sequelize migrations"
	@echo "  db-migrate-undo    Rollback last migration"
	@echo "  db-seed            Run seeders"
	@echo "  clean              Remove node_modules and build artifacts"

install:
	pnpm install

dev:
	pnpm dev

start:
	pnpm start

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

format-check:
	pnpm format:check

test:
	pnpm test

test-watch:
	pnpm test:watch

test-coverage:
	pnpm test:coverage

test-integration:
	pnpm test:integration

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

db-migrate:
	pnpm db:migrate

db-migrate-undo:
	pnpm db:migrate:undo

db-seed:
	pnpm db:seed

clean:
	rm -rf node_modules dist coverage
