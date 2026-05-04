"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vote_controller_1 = require("../controllers/vote.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const voteRouter = (0, express_1.Router)();
// POST /api/votes
// Headers: Authorization: Bearer <token>
// Body: { electionId, candidateId }
// Response: { receiptHash, castedAt }
voteRouter.post('/', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['VOTER']), rateLimit_middleware_1.rateLimitMiddleware.vote, vote_controller_1.voteController.castVote);
// GET /api/votes/receipt/:hash
// Response: { receipt: { receiptHash, electionId, castedAt } }
voteRouter.get('/receipt/:hash', auth_middleware_1.authMiddleware, vote_controller_1.voteController.getReceipt);
// GET /api/votes/status/:electionId
// Response: { hasVoted: true/false }
voteRouter.get('/status/:electionId', auth_middleware_1.authMiddleware, vote_controller_1.voteController.checkVoteStatus);
exports.default = voteRouter;
