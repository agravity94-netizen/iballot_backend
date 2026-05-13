import { Router } from 'express';
import { electionController } from '../controllers/election.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';

const router = Router();

// GET /api/elections?status=ACTIVE&constituencyId=xxx
// Headers: Authorization: Bearer <token>
// Response: { elections: [{ id, title, status, startDate, endDate, candidateCount }] }
router.get('/', authMiddleware, electionController.getAll);

// GET /api/elections/:id
// Response: { election: { id, title, description, status, candidates[] } }
router.get('/:id', authMiddleware, electionController.getById);

// GET /api/elections/:id/candidates
// Response: { candidates: [{ id, name, photo, voteCount, votePercentage, rank }] }
router.get('/:id/candidates', authMiddleware, electionController.getCandidates);

// GET /api/elections/:id/results
// Response: { results: [{ candidateId, voteCount, votePercentage, rank }], totalVotes }
router.get('/:id/results', authMiddleware, electionController.getResults);

// GET /api/elections/:id/analytics  [ADMIN only]
// Response: { totalVoters, totalVoted, turnoutPercent, votesByHour[] }
router.get('/:id/analytics', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), electionController.getAnalytics);

// POST /api/elections  [ADMIN only]
// Body: { title, description, constituencyId, type, startDate, endDate }
// Response: { election: { id, title, status: "DRAFT" } }
router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), electionController.create);

// PATCH /api/elections/:id/status  [ADMIN only]
// Body: { status: "PUBLISHED" | "ACTIVE" | "PAUSED" | "CLOSED" }
// Response: { election: { id, status } }
router.patch('/:id/status', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), electionController.updateStatus);

// PATCH /api/elections/:id  [ADMIN only]
// Body: { title?, description?, constituencyId?, type?, startDate?, endDate? }
// Response: { election: <updated> }
// Only allowed when status is DRAFT or PUBLISHED
router.patch('/:id', authMiddleware, roleMiddleware(['ADMIN', 'SUPER_ADMIN']), electionController.update);

export default router;
