import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();

const adminOnly = [authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN'])];

// Dashboard
router.get('/stats', ...adminOnly, adminController.getDashboardStats);

// Voters Management
router.get('/voters', ...adminOnly, adminController.getVoters);
router.patch('/voters/:id/status', ...adminOnly, adminController.updateVoterStatus);
router.delete('/voters/:id', ...adminOnly, adminController.deleteVoter);

// Candidate Management
router.get('/candidates', ...adminOnly, adminController.getCandidates);
router.patch('/candidates/:id/status', ...adminOnly, adminController.updateCandidateStatus);

// Fraud Alerts
router.get('/fraud-alerts', ...adminOnly, adminController.getFraudAlerts);
router.patch('/fraud-alerts/:id/resolve', ...adminOnly, adminController.resolveFraudAlert);

export default router;
