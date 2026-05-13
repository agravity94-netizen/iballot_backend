import { Router } from 'express';
import { appealController } from '../controllers/appeal.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();

// User routes
router.post('/', authMiddleware, appealController.submitAppeal);

// Admin routes
router.get('/admin', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), appealController.getAppeals);
router.get('/admin/:id', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), appealController.getAppealById);
router.patch('/admin/:id/resolve', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), appealController.resolveAppeal);

export default router;
