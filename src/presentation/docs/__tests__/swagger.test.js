import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  execSync: vi.fn(),
  load: vi.fn(),
  swaggerUiSetup: vi.fn(),
  swaggerUiServe: vi.fn(),
}));

vi.mock('node:child_process', () => ({ execSync: mocks.execSync }));
vi.mock('node:fs', () => ({
  default: { existsSync: mocks.existsSync, readFileSync: mocks.readFileSync },
}));
vi.mock('js-yaml', () => ({ load: mocks.load }));
vi.mock('swagger-ui-express', () => ({
  default: { setup: mocks.swaggerUiSetup, serve: mocks.swaggerUiServe },
}));

const spec = { openapi: '3.0.3', info: { title: 'Qatu', version: '1.0.0' } };

describe('registerApiDocs', () => {
  let registerApiDocs;

  beforeEach(async () => {
    vi.resetModules();
    mocks.existsSync.mockReset();
    mocks.readFileSync.mockReset();
    mocks.execSync.mockReset();
    mocks.load.mockReset();
    mocks.swaggerUiSetup.mockReset();
    mocks.swaggerUiServe.mockReset();
    vi.unstubAllEnvs();
    ({ registerApiDocs } = await import('../swagger.js'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = { get: vi.fn(), use: vi.fn() };

    registerApiDocs(app);

    expect(app.get).not.toHaveBeenCalled();
    expect(app.use).not.toHaveBeenCalled();
  });

  it('does nothing when no spec can be loaded', () => {
    vi.stubEnv('NODE_ENV', 'test');
    mocks.existsSync.mockReturnValue(false);
    mocks.execSync.mockImplementation(() => {
      throw new Error('cli missing');
    });
    const app = { get: vi.fn(), use: vi.fn() };

    registerApiDocs(app);

    expect(mocks.execSync).toHaveBeenCalled();
    expect(app.get).not.toHaveBeenCalled();
  });

  it('loads an existing bundle and registers the JSON handler and Swagger UI', () => {
    vi.stubEnv('NODE_ENV', 'test');
    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockReturnValue('openapi: 3.0.3');
    mocks.load.mockReturnValue(spec);
    mocks.swaggerUiSetup.mockReturnValue(vi.fn());
    const app = { get: vi.fn(), use: vi.fn() };

    registerApiDocs(app);

    expect(mocks.readFileSync).toHaveBeenCalled();
    expect(mocks.execSync).not.toHaveBeenCalled();
    expect(app.get).toHaveBeenCalledWith('/api-docs/openapi.json', expect.any(Function));
    expect(app.use).toHaveBeenCalledWith(
      '/api-docs',
      expect.any(Function),
      mocks.swaggerUiServe,
      expect.any(Function)
    );

    const [, jsonHandler] = app.get.mock.calls[0];
    const res = { json: vi.fn(), setHeader: vi.fn() };
    jsonHandler({}, res);
    expect(res.json).toHaveBeenCalledWith(spec);

    const cspMiddleware = app.use.mock.calls[0][1];
    const next = vi.fn();
    cspMiddleware({}, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
    expect(next).toHaveBeenCalled();
  });

  it('bundles the spec on demand when the bundle is initially absent', () => {
    vi.stubEnv('NODE_ENV', 'test');
    mocks.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
    mocks.readFileSync.mockReturnValue('openapi: 3.0.3');
    mocks.load.mockReturnValue(spec);
    mocks.swaggerUiSetup.mockReturnValue(vi.fn());
    const app = { get: vi.fn(), use: vi.fn() };

    registerApiDocs(app);

    expect(mocks.execSync).toHaveBeenCalledWith(
      'npx @redocly/cli bundle qatu@v1 -o dist/openapi.bundle.yaml',
      expect.objectContaining({ stdio: 'ignore' })
    );
    expect(app.get).toHaveBeenCalled();
  });

  it('does nothing when bundling succeeds but the bundle file is still missing', () => {
    vi.stubEnv('NODE_ENV', 'test');
    mocks.existsSync.mockReturnValue(false);
    const app = { get: vi.fn(), use: vi.fn() };

    registerApiDocs(app);

    expect(app.get).not.toHaveBeenCalled();
  });
});
