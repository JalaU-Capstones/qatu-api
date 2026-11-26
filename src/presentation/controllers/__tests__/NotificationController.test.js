import { describe, expect, it } from 'vitest';
import { NotificationController } from '../NotificationController.js';

const useCase = { execute: async () => ({}) };
const deps = {
  listNotificationsUseCase: useCase,
  getUnreadNotificationsCountUseCase: useCase,
  markNotificationReadUseCase: useCase,
  markAllNotificationsReadUseCase: useCase,
};

describe('NotificationController', () => {
  it.each(Object.keys(deps))('requires %s', (missing) => {
    const partial = { ...deps, [missing]: undefined };

    expect(() => new NotificationController(partial)).toThrow(`${missing} is required`);
  });

  it('requires every use case when constructed without arguments', () => {
    expect(() => new NotificationController()).toThrow('listNotificationsUseCase is required');
  });
});
