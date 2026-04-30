import { Router } from 'express';
import { voteController } from '../controllers/vote.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const voteRouter = Router();

// POST /api/votes
// Headers: Authorization: Bearer <token>
// Body: { electionId, candidateId }
// Response: { receiptHash, castedAt }
voteRouter.post('/', authMiddleware, roleMiddleware(['VOTER']), rateLimitMiddleware.vote, voteController.castVote);

// GET /api/votes/receipt/:hash
// Response: { receipt: { receiptHash, electionId, castedAt } }
voteRouter.get('/receipt/:hash', authMiddleware, voteController.getReceipt);

// GET /api/votes/status/:electionId
// Response: { hasVoted: true/false }
voteRouter.get('/status/:electionId', authMiddleware, voteController.checkVoteStatus);

export default voteRouter;
