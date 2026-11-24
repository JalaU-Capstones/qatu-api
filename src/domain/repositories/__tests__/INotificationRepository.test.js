import { describe, expect, it } from 'vitest';
import { INotificationRepository } from '../INotificationRepository.js';

class ConcreteNotificationRepository extends INotificationRepository {}

describe('INotificationRepository contract', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new INotificationRepository()).toThrow(
      'INotificationRepository cannot be instantiated'
    );
  });

  it('allows construction when new.target is a different constructor', () => {
    class Foreign {}

    expect(() => Reflect.construct(INotificationRepository, [], Foreign)).not.toThrow();
  });

  it('can be extended by a concrete repository', () => {
    expect(new ConcreteNotificationRepository()).toBeInstanceOf(INotificationRepository);
  });

  it('createFromEvent throws Method not implemented', async () => {
    const repository = new ConcreteNotificationRepository();

    await expect(
      repository.createFromEvent({
        eventId: 'event-1',
        profileId: 'profile-1',
        type: 'message.sent',
        title: 'New message',
        body: 'You have a new message',
        actionUrl: '/messages',
        payload: {},
      })
    ).rejects.toThrow('Method not implemented: createFromEvent');
  });
});
