import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const seeder = require('../seeders/20261010000026-seed-sample-products.js');

/**
 * The seeder builds one big SQL string inside a JS template literal. A stray backtick in a SQL
 * comment silently ends the literal and the seeder crashes at runtime
 * (`SELLER_EMAIL.local is not a function`), which no unit test noticed because the integration
 * tests need Docker. Running `up`/`down` against a fake query interface catches that class of bug.
 */
function fakeQueryInterface() {
  const transaction = { commit: vi.fn(), rollback: vi.fn() };
  const queries = [];
  const queryInterface = {
    sequelize: {
      transaction: vi.fn().mockResolvedValue(transaction),
      query: vi.fn(async (sql) => {
        queries.push(sql);
      }),
    },
  };
  return { queryInterface, transaction, queries };
}

describe('seed-sample-products', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('up() runs and commits (the SQL template literal is well formed)', async () => {
    const { queryInterface, transaction, queries } = fakeQueryInterface();

    await seeder.up(queryInterface);

    expect(queries).toHaveLength(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it('seeds the catalog owner with a routable e-mail domain and the seller role', async () => {
    const { queryInterface, queries } = fakeQueryInterface();

    await seeder.up(queryInterface);

    const [sql] = queries;
    expect(sql).toContain("'seller@example.qatu.pe'");
    expect(sql).not.toContain("'seller@qatu.local'");
    expect(sql).toContain("r.name = 'seller'");
    // Re-seeding must migrate a database that still has the old non-routable e-mail.
    expect(sql).toContain('on conflict (id) do update set email = excluded.email');
  });

  it('seeds published products owned by the seller id (not by e-mail)', async () => {
    const { queryInterface, queries } = fakeQueryInterface();

    await seeder.up(queryInterface);

    expect(queries[0]).toContain('00000000-0000-0000-0000-000000000002');
    expect(queries[0]).toContain('insert into public.products');
  });

  it('up() does nothing in production', async () => {
    process.env.NODE_ENV = 'production';
    const { queryInterface, queries } = fakeQueryInterface();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await seeder.up(queryInterface);

    expect(queries).toHaveLength(0);
    expect(queryInterface.sequelize.transaction).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rolls back and rethrows when the SQL fails', async () => {
    const { queryInterface, transaction } = fakeQueryInterface();
    queryInterface.sequelize.query.mockRejectedValueOnce(new Error('boom'));

    await expect(seeder.up(queryInterface)).rejects.toThrow('boom');

    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('down() runs and commits', async () => {
    const { queryInterface, transaction, queries } = fakeQueryInterface();

    await seeder.down(queryInterface);

    expect(queries.length).toBeGreaterThan(0);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });
});
