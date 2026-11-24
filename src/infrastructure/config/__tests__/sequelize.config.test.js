import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const configPath = fileURLToPath(new URL('../sequelize.config.js', import.meta.url));
// eslint-disable-next-line security/detect-non-literal-fs-filename
const source = readFileSync(configPath, 'utf8');

const loadConfig = (env) => {
  const config = vi.fn();
  const module = { exports: {} };
  runInNewContext(
    source,
    {
      console,
      module,
      process: { env },
      require: (id) => {
        if (id === 'dotenv') return { config };
        throw new Error(`Unexpected require: ${id}`);
      },
    },
    { filename: configPath }
  );
  return { config: module.exports, dotenvConfig: config };
};

describe('sequelize.config.js (CommonJS)', () => {
  it('loads dotenv and keeps the development logging and no SSL', () => {
    const { config, dotenvConfig } = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://localhost/qatu',
    });

    expect(dotenvConfig).toHaveBeenCalledTimes(1);
    expect(config.development.url).toBe('postgres://localhost/qatu');
    expect(config.development.dialect).toBe('postgres');
    // eslint-disable-next-line no-console
    expect(config.development.logging).toBe(console.log);
    expect(config.development.dialectOptions).toEqual({});
    expect(config.development.define).toEqual({ underscored: true, timestamps: true });
    // eslint-disable-next-line no-console
    expect(config.test.logging).toBe(console.log);
    // eslint-disable-next-line no-console
    expect(config.production.logging).toBe(console.log);
  });

  it('enables SSL for every exported environment when NODE_ENV is production', () => {
    const { config } = loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://prod' });
    const ssl = { ssl: { require: true, rejectUnauthorized: false } };

    expect(config.production.dialectOptions).toEqual(ssl);
    expect(config.development.dialectOptions).toEqual(ssl);
    expect(config.test.dialectOptions).toEqual(ssl);
  });

  it('shares the same url across environments', () => {
    const { config } = loadConfig({ DATABASE_URL: 'postgres://shared' });

    expect(config.development.url).toBe('postgres://shared');
    expect(config.test.url).toBe('postgres://shared');
    expect(config.production.url).toBe('postgres://shared');
  });
});
