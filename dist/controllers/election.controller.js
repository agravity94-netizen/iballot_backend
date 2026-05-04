"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electionController = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const prisma = new client_1.PrismaClient();
exports.electionController = {
    // GET /api/elections
    getAll: async (req, res) => {
        try {
            const { status, constituencyId } = req.query;
            const userId = req.user.userId;
            // Get user's constituency if not specified
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const elections = await prisma.election.findMany({
                where: {
                    ...(status && { status: status }),
                    constituencyId: constituencyId || user?.constituencyId || undefined
                },
                include: {
                    _count: { select: { candidates: true } }
                },
                orderBy: { startDate: 'desc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Elections fetched', {
                elections: elections.map((e) => ({
                    id: e.id,
                    title: e.title,
                    type: e.type,
                    status: e.status,
                    startDate: e.startDate,
                    endDate: e.endDate,
                    candidateCount: e._count.candidates
                }))
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id
    getById: async (req, res) => {
        try {
            const election = await prisma.election.findUnique({
                where: { id: String(req.params.id) },
                include: { constituency: true }
            });
            if (!election)
                return (0, response_1.sendError)(res, 404, 'Election not found');
            return (0, response_1.sendSuccess)(res, 200, 'Election fetched', { election });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id/candidates
    getCandidates: async (req, res) => {
        try {
            const candidates = await prisma.candidate.findMany({
                where: { electionId: String(req.params.id), status: 'APPROVED' },
                include: {
                    user: { select: { email: true } },
                    profile: true,
                    voteCount: true
                }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Candidates fetched', { candidates });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id/results — uses materialized view
    getResults: async (req, res) => {
        try {
            const results = await prisma.$queryRaw `
        SELECT * FROM "ElectionResults"
        WHERE "electionId" = ${String(req.params.id)}::uuid
        ORDER BY "rank" ASC
      `;
            const totalVotes = await prisma.voteReceipt.count({
                where: { electionId: String(req.params.id) }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Results fetched', { results, totalVotes });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id/analytics
    getAnalytics: async (req, res) => {
        try {
            const electionId = String(req.params.id);
            const [totalVoters, totalVoted, votesByHour] = await Promise.all([
                // Total eligible voters in constituency
                prisma.user.count({
                    where: {
                        role: 'VOTER',
                        isVerified: true,
                        constituency: {
                            elections: { some: { id: electionId } }
                        }
                    }
                }),
                // Total who voted
                prisma.voteReceipt.count({ where: { electionId } }),
                // Votes by hour for turnout chart
                prisma.$queryRaw `
          SELECT
            DATE_TRUNC('hour', "castedAt") AS hour,
            COUNT(*) AS votes
          FROM "VoteReceipt"
          WHERE "electionId" = ${electionId}::uuid
          GROUP BY hour
          ORDER BY hour ASC
        `
            ]);
            return (0, response_1.sendSuccess)(res, 200, 'Analytics fetched', {
                totalVoters,
                totalVoted,
                turnoutPercent: totalVoters > 0 ? ((totalVoted / totalVoters) * 100).toFixed(2) : 0,
                votesByHour
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/elections
    create: async (req, res) => {
        try {
            const { title, description, constituencyId, type, startDate, endDate } = req.body;
            const createdBy = req.user.userId;
            if (new Date(startDate) >= new Date(endDate)) {
                return (0, response_1.sendError)(res, 400, 'Start date must be before end date');
            }
            const election = await prisma.election.create({
                data: { title, description, constituencyId, type, startDate, endDate, createdBy }
            });
            await (0, auditLog_1.auditLog)({ action: 'ELECTION_CREATED', entity: 'Election', entityId: election.id, actorId: createdBy });
            return (0, response_1.sendSuccess)(res, 201, 'Election created', { election });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // PATCH /api/elections/:id/status
    updateStatus: async (req, res) => {
        try {
            const { status } = req.body;
            const actorId = req.user.userId;
            const validTransitions = {
                DRAFT: ['PUBLISHED'],
                PUBLISHED: ['ACTIVE', 'DRAFT'],
                ACTIVE: ['PAUSED', 'CLOSED'],
                PAUSED: ['ACTIVE', 'CLOSED'],
                CLOSED: ['RESULTS_PUBLISHED']
            };
            const election = await prisma.election.findUnique({ where: { id: String(req.params.id) } });
            if (!election)
                return (0, response_1.sendError)(res, 404, 'Election not found');
            if (!validTransitions[election.status]?.includes(status)) {
                return (0, response_1.sendError)(res, 400, `Cannot transition from ${election.status} to ${status}`);
            }
            const updated = await prisma.election.update({
                where: { id: String(req.params.id) },
                data: {
                    status,
                    ...(status === 'RESULTS_PUBLISHED' && { resultsPublishedAt: new Date() })
                }
            });
            await (0, auditLog_1.auditLog)({ action: `ELECTION_${status}`, entity: 'Election', entityId: election.id, actorId });
            return (0, response_1.sendSuccess)(res, 200, `Election ${status.toLowerCase()}`, { election: updated });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
