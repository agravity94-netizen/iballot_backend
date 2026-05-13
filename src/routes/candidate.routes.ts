import { Router } from 'express';
import { candidateController } from '../controllers/candidate.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, candidateController.getAll);
router.get('/compare', authMiddleware, candidateController.compare);
router.get('/:id', authMiddleware, candidateController.getById);

export default router;
