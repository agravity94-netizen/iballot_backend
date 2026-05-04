import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();

// Voters Management
router.get('/voters', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), adminController.getVoters);
router.get('/stats', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), adminController.getDashboardStats);
router.patch('/voters/:id/status', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), adminController.updateVoterStatus);

export default router;
