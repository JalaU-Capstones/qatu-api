import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';

const require = createRequire(import.meta.url);
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations'
);

/** Runs every real migration in order, so tests use the exact production schema. */
export async function runMigrations(sequelize) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+.*\.js$/.test(file))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line security/detect-non-literal-require
    const migration = require(path.join(MIGRATIONS_DIR, file));
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  }
}

/**
 * Throw-away migrated PostgreSQL for one test file: `<TEST_DATABASE_URL db>_<suffix>` when that
 * variable is set (CI), otherwise a Testcontainer.
 */
export async function createMigratedTestDatabase(suffix) {
  let container = null;
  let adminSequelize = null;
  let isolatedDbName = null;
  let sequelize;

  if (process.env.TEST_DATABASE_URL) {
    const baseUrl = new URL(process.env.TEST_DATABASE_URL);
    const originalDb = baseUrl.pathname.replace(/^\//, '') || 'postgres';
    isolatedDbName = `${originalDb}_${suffix}`;

    const adminUrl = new URL(process.env.TEST_DATABASE_URL);
    adminUrl.pathname = '/postgres';
    adminSequelize = new Sequelize(adminUrl.toString(), { logging: false });
    await adminSequelize.query(`drop database if exists "${isolatedDbName}" with (force);`);
    await adminSequelize.query(`create database "${isolatedDbName}";`);

    const targetUrl = new URL(process.env.TEST_DATABASE_URL);
    targetUrl.pathname = `/${isolatedDbName}`;
    sequelize = new Sequelize(targetUrl.toString(), { logging: false });
  } else {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('qatu_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    sequelize = new Sequelize(container.getConnectionUri(), { logging: false });
  }

  await runMigrations(sequelize);

  return {
    sequelize,
    async close() {
      await sequelize.close();
      if (adminSequelize) {
        try {
          await adminSequelize.query(`drop database if exists "${isolatedDbName}" with (force);`);
        } finally {
          await adminSequelize.close();
        }
      }
      await container?.stop();
    },
  };
}
