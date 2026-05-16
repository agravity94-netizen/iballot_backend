import { Router } from 'express';
import { candidateController } from '../controllers/candidate.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, candidateController.getAll);
router.get('/me', authMiddleware, candidateController.getMe);
router.get('/metadata', authMiddleware, candidateController.getMetadata);
router.get('/my-applications', authMiddleware, candidateController.getMyApplications);
router.get('/applications/:id', authMiddleware, candidateController.getApplicationById);
router.post('/apply', authMiddleware, candidateController.apply);
router.get('/compare', authMiddleware, candidateController.compare);
router.get('/:id', authMiddleware, candidateController.getById);

export default router;
