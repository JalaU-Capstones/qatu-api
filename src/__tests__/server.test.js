import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const server = { close: vi.fn() };
  const app = {
    locals: {},
    listen: vi.fn((_port, callback) => {
      callback();
      return server;
    }),
  };
  const messaging = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  return {
    app,
    server,
    messaging,
    createMessagingService: vi.fn(() => messaging),
    logger: { info: vi.fn() },
    env: { PORT: '', RABBITMQ_ENABLED: false },
  };
});

vi.mock('../app.js', () => ({ app: mocks.app }));
vi.mock('../infrastructure/config/env.js', () => ({ env: mocks.env }));
vi.mock('../infrastructure/logging/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../infrastructure/messaging/createMessagingService.js', () => ({
  createMessagingService: mocks.createMessagingService,
}));

describe('server entry point', () => {
  let handlers;
  let onceSpy;
  let exitSpy;

  beforeEach(() => {
    vi.resetModules();
    handlers = new Map();
    mocks.app.locals = {};
    mocks.env.PORT = '';
    mocks.env.RABBITMQ_ENABLED = false;
    mocks.app.listen.mockClear();
    mocks.server.close.mockClear();
    mocks.createMessagingService.mockClear();
    mocks.messaging.start.mockClear();
    mocks.messaging.stop.mockClear();
    mocks.logger.info.mockClear();
    onceSpy = vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers.set(event, handler);
      return process;
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
  });

  afterEach(() => {
    onceSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('starts with the default port, logs a startup message and registers shutdown handlers', async () => {
    await import('../server.js');

    expect(mocks.app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'RabbitMQ messaging disabled (set RABBITMQ_ENABLED=true to enable it)'
    );
    expect(mocks.createMessagingService).not.toHaveBeenCalled();
    expect(handlers.has('SIGTERM')).toBe(true);
    expect(handlers.has('SIGINT')).toBe(true);

    handlers.get('SIGTERM')();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.logger.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'Shutting down');
    expect(mocks.server.close).toHaveBeenCalledOnce();
    expect(mocks.messaging.stop).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('starts the messaging service when RabbitMQ is enabled and stops it on shutdown', async () => {
    mocks.env.PORT = '4000';
    mocks.env.RABBITMQ_ENABLED = true;

    await import('../server.js');

    expect(mocks.app.listen).toHaveBeenCalledWith('4000', expect.any(Function));
    expect(mocks.createMessagingService).toHaveBeenCalledWith(mocks.env);
    expect(mocks.app.locals.messaging).toBe(mocks.messaging);
    expect(mocks.messaging.start).toHaveBeenCalledOnce();
    expect(mocks.logger.info).not.toHaveBeenCalledWith(
      'RabbitMQ messaging disabled (set RABBITMQ_ENABLED=true to enable it)'
    );

    handlers.get('SIGINT')();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.logger.info).toHaveBeenCalledWith({ signal: 'SIGINT' }, 'Shutting down');
    expect(mocks.messaging.stop).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
