import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { voterController } from '../controllers/voter.controller';

const router = Router();

router.get('/history', authMiddleware, voterController.getHistory);

export default router;
