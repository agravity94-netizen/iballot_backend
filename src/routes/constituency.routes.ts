import { Router } from 'express';
import { constituencyController } from '../controllers/constituency.controller';

const router = Router();

router.get('/', constituencyController.getAll);
router.get('/locations', constituencyController.getLocations);

export default router;
