import { Router } from 'express';
import { candidateController } from '../controllers/candidate.controller';

const router = Router();

// GET /api/candidates
router.get('/', candidateController.getAll);

export default router;
