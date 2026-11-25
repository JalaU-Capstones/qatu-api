import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const migrationsDir = 'src/infrastructure/persistence/migrations';
const seedersDir = 'src/infrastructure/persistence/seeders';

const loadModules = async (dir, files) =>
  Promise.all(
    files.map(async (file) => {
      const module = await import(pathToFileURL(path.join(dir, file)).href);
      return { file, module: module.default ?? module };
    })
  );

const migrations = await loadModules(
  migrationsDir,
  readdirSync('src/infrastructure/persistence/migrations')
    .filter((file) => file.endsWith('.js'))
    .sort()
);
const seeders = await loadModules(
  seedersDir,
  readdirSync('src/infrastructure/persistence/seeders')
    .filter((file) => file.endsWith('.js') && file !== '20261010000026-seed-sample-products.js')
    .sort()
);

const transactionalMigrations = migrations.filter(
  ({ module }) => module.up.length > 0 && module.down.length > 0
);
const upOnlyMigrations = migrations.filter(
  ({ module }) => module.up.length > 0 && module.down.length === 0
);
const noOpMigrations = migrations.filter(
  ({ module }) => module.up.length === 0 && module.down.length === 0
);

const createInfrastructure = ({ fail = false, queryResults = [] } = {}) => {
  const results = [...queryResults];
  const transaction = {
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
  const query = vi.fn(async () => {
    if (fail) throw new Error('query failed');
    return results.length > 0 ? results.shift() : [[{ ok: 1 }]];
  });

  return {
    query,
    queryInterface: {
      sequelize: {
        query,
        transaction: vi.fn().mockResolvedValue(transaction),
      },
    },
    transaction,
  };
};

const cases = (modules) => modules.map(({ file, module }) => [file, module]);

const authCheckingSeeders = ['20261010000025-seed-admin-user.js'];

const productionSkippingSeeders = [
  '20261010000025-seed-admin-user.js',
  '20261117000000-seed-profiles-for-seeded-users.js',
];

describe('database migrations', () => {
  it.each(cases(transactionalMigrations))(
    '%s commits up and down on success',
    async (_file, migration) => {
      const { query, queryInterface, transaction } = createInfrastructure();

      await expect(migration.up(queryInterface, {})).resolves.toBeUndefined();
      await expect(migration.down(queryInterface, {})).resolves.toBeUndefined();

      expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalled();
      expect(transaction.commit).toHaveBeenCalledTimes(2);
      expect(transaction.rollback).not.toHaveBeenCalled();
    }
  );

  it.each(cases(transactionalMigrations))(
    '%s rolls back and rethrows on failure',
    async (_file, migration) => {
      const { queryInterface, transaction } = createInfrastructure({ fail: true });

      await expect(migration.up(queryInterface, {})).rejects.toThrow('query failed');
      await expect(migration.down(queryInterface, {})).rejects.toThrow('query failed');

      expect(transaction.rollback).toHaveBeenCalledTimes(2);
      expect(transaction.commit).not.toHaveBeenCalled();
    }
  );

  it.each(cases(upOnlyMigrations))(
    '%s commits up and keeps down as a no-op',
    async (_file, migration) => {
      const { query, queryInterface, transaction } = createInfrastructure();

      await expect(migration.up(queryInterface, {})).resolves.toBeUndefined();
      await expect(migration.down(queryInterface, {})).resolves.toBeUndefined();

      expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledTimes(1);
      expect(transaction.commit).toHaveBeenCalledTimes(1);
      expect(transaction.rollback).not.toHaveBeenCalled();
    }
  );

  it.each(cases(upOnlyMigrations))(
    '%s rolls back when up fails and ignores the failure in down',
    async (_file, migration) => {
      const { queryInterface, transaction } = createInfrastructure({ fail: true });

      await expect(migration.up(queryInterface, {})).rejects.toThrow('query failed');
      await expect(migration.down(queryInterface, {})).resolves.toBeUndefined();

      expect(transaction.rollback).toHaveBeenCalledTimes(1);
      expect(transaction.commit).not.toHaveBeenCalled();
    }
  );

  it.each(cases(noOpMigrations))(
    '%s stays a no-op in both directions',
    async (_file, migration) => {
      const { query, queryInterface } = createInfrastructure({ fail: true });

      await expect(migration.up(queryInterface, {})).resolves.toBeUndefined();
      await expect(migration.down(queryInterface, {})).resolves.toBeUndefined();

      expect(queryInterface.sequelize.transaction).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    }
  );
});

describe('database seeders', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let warnSpy;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warnSpy.mockRestore();
  });

  it.each(cases(seeders))('%s commits up and down on success', async (_file, seeder) => {
    const { queryInterface, transaction } = createInfrastructure();

    await expect(seeder.up(queryInterface, {})).resolves.toBeUndefined();
    await expect(seeder.down(queryInterface, {})).resolves.toBeUndefined();

    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(2);
    expect(transaction.commit).toHaveBeenCalledTimes(2);
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it.each(cases(seeders))('%s rolls back and rethrows on failure', async (_file, seeder) => {
    const { queryInterface, transaction } = createInfrastructure({ fail: true });

    await expect(seeder.up(queryInterface, {})).rejects.toThrow('query failed');
    await expect(seeder.down(queryInterface, {})).rejects.toThrow('query failed');

    expect(transaction.rollback).toHaveBeenCalledTimes(2);
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it.each(authCheckingSeeders)(
    '%s fails clearly when the seeded auth user is missing',
    async (file) => {
      const seeder = seeders.find((entry) => entry.file === file).module;
      const { queryInterface, transaction } = createInfrastructure({ queryResults: [[[]]] });

      await expect(seeder.up(queryInterface, {})).rejects.toThrow(/auth\.users row is missing/);

      expect(transaction.rollback).toHaveBeenCalled();
      expect(transaction.commit).not.toHaveBeenCalled();
    }
  );

  it.each(productionSkippingSeeders)('%s skips in production', async (file) => {
    const seeder = seeders.find((entry) => entry.file === file).module;
    process.env.NODE_ENV = 'production';
    const { queryInterface } = createInfrastructure();

    await expect(seeder.up(queryInterface, {})).resolves.toBeUndefined();

    expect(queryInterface.sequelize.transaction).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Skipping seeder in production.');
  });
});
