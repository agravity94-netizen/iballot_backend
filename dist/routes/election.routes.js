"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const election_controller_1 = require("../controllers/election.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
// GET /api/elections?status=ACTIVE&constituencyId=xxx
// Headers: Authorization: Bearer <token>
// Response: { elections: [{ id, title, status, startDate, endDate, candidateCount }] }
router.get('/', auth_middleware_1.authMiddleware, election_controller_1.electionController.getAll);
// GET /api/elections/:id
// Response: { election: { id, title, description, status, candidates[] } }
router.get('/:id', auth_middleware_1.authMiddleware, election_controller_1.electionController.getById);
// GET /api/elections/:id/candidates
// Response: { candidates: [{ id, name, photo, voteCount, votePercentage, rank }] }
router.get('/:id/candidates', auth_middleware_1.authMiddleware, election_controller_1.electionController.getCandidates);
// GET /api/elections/:id/results
// Response: { results: [{ candidateId, voteCount, votePercentage, rank }], totalVotes }
router.get('/:id/results', auth_middleware_1.authMiddleware, election_controller_1.electionController.getResults);
// GET /api/elections/:id/analytics  [ADMIN only]
// Response: { totalVoters, totalVoted, turnoutPercent, votesByHour[] }
router.get('/:id/analytics', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), election_controller_1.electionController.getAnalytics);
// POST /api/elections  [ADMIN only]
// Body: { title, description, constituencyId, type, startDate, endDate }
// Response: { election: { id, title, status: "DRAFT" } }
router.post('/', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), election_controller_1.electionController.create);
// PATCH /api/elections/:id/status  [ADMIN only]
// Body: { status: "PUBLISHED" | "ACTIVE" | "PAUSED" | "CLOSED" }
// Response: { election: { id, status } }
router.patch('/:id/status', auth_middleware_1.authMiddleware, (0, role_middleware_1.roleMiddleware)(['ADMIN', 'SUPER_ADMIN']), election_controller_1.electionController.updateStatus);
exports.default = router;
