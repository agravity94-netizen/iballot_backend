import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.get('/', authMiddleware, notificationController.getAll);
router.patch('/read-all', authMiddleware, notificationController.markAllRead);
router.patch('/:id/read', authMiddleware, notificationController.markRead);

export default router;
