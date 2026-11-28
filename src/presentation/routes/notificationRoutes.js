import { Router } from 'express';
import { GetUnreadNotificationsCountUseCase } from '../../application/use-cases/GetUnreadNotificationsCountUseCase.js';
import { ListNotificationsUseCase } from '../../application/use-cases/ListNotificationsUseCase.js';
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/MarkAllNotificationsReadUseCase.js';
import { MarkNotificationReadUseCase } from '../../application/use-cases/MarkNotificationReadUseCase.js';
import { NotificationRepository } from '../../infrastructure/persistence/repositories/NotificationRepository.js';
import { NotificationController } from '../controllers/NotificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
} from '../validators/notificationSchema.js';

export function createNotificationRouter({
  notificationRepository = new NotificationRepository(),
  listNotificationsUseCase,
  getUnreadNotificationsCountUseCase,
  markNotificationReadUseCase,
  markAllNotificationsReadUseCase,
  notificationController,
} = {}) {
  const router = Router();

  const controller =
    notificationController ||
    new NotificationController({
      listNotificationsUseCase:
        listNotificationsUseCase || new ListNotificationsUseCase({ notificationRepository }),
      getUnreadNotificationsCountUseCase:
        getUnreadNotificationsCountUseCase ||
        new GetUnreadNotificationsCountUseCase({ notificationRepository }),
      markNotificationReadUseCase:
        markNotificationReadUseCase || new MarkNotificationReadUseCase({ notificationRepository }),
      markAllNotificationsReadUseCase:
        markAllNotificationsReadUseCase ||
        new MarkAllNotificationsReadUseCase({ notificationRepository }),
    });

  router.get(
    '/',
    authMiddleware,
    validateRequest(listNotificationsSchema, { source: 'query' }),
    (req, res, next) => controller.listNotifications(req, res, next)
  );

  router.get('/unread-count', authMiddleware, (req, res, next) =>
    controller.getUnreadCount(req, res, next)
  );

  router.patch('/read-all', authMiddleware, (req, res, next) =>
    controller.markAllAsRead(req, res, next)
  );

  router.patch(
    '/:notificationId/read',
    authMiddleware,
    validateRequest(notificationIdParamSchema, { source: 'params' }),
    (req, res, next) => controller.markAsRead(req, res, next)
  );

  return router;
}

export const notificationRouter = createNotificationRouter();
