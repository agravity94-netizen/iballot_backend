"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.electionController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
// Using global prisma
exports.electionController = {
    // GET /api/elections
    getAll: async (req, res) => {
        try {
            const { status, constituencyId } = req.query;
            const userId = req.user.userId;
            const user = await database_1.default.user.findUnique({
                where: { id: userId },
                select: { constituencyId: true, isVerified: true, isActive: true, role: true },
            });
            const elections = await database_1.default.election.findMany({
                where: {
                    ...(status && { status: status }),
                    constituencyId: constituencyId || user?.constituencyId || undefined,
                },
                include: {
                    constituency: true,
                    _count: { select: { candidates: true } },
                    voteReceipts: {
                        where: { userId },
                        select: { receiptHash: true, castedAt: true },
                        take: 1,
                    },
                },
                orderBy: { startDate: 'desc' },
            });
            const now = new Date();
            return (0, response_1.sendSuccess)(res, 200, 'Elections fetched', {
                elections: elections.map((e) => {
                    const voteReceipt = e.voteReceipts[0] || null;
                    const isEligible = Boolean(user?.constituencyId) && user?.isVerified && user?.isActive && user?.role === 'VOTER';
                    const hasVoted = Boolean(voteReceipt);
                    const canVoteNow = isEligible && !hasVoted && e.status === 'ACTIVE' && e.startDate <= now && e.endDate >= now;
                    return {
                        id: e.id,
                        title: e.title,
                        type: e.type,
                        status: e.status,
                        startDate: e.startDate,
                        endDate: e.endDate,
                        candidateCount: e._count.candidates,
                        isEligible,
                        hasVoted,
                        canVoteNow,
                        canViewResults: e.status === 'RESULTS_PUBLISHED',
                        receiptHash: voteReceipt?.receiptHash || null,
                        castedAt: voteReceipt?.castedAt || null,
                        constituency: e.constituency
                            ? {
                                id: e.constituency.id,
                                name: e.constituency.name,
                                code: e.constituency.code,
                                type: e.constituency.type,
                            }
                            : null,
                    };
                })
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id
    getById: async (req, res) => {
        try {
            const userId = req.user.userId;
            const [election, user, receipt] = await Promise.all([
                database_1.default.election.findUnique({
                    where: { id: String(req.params.id) },
                    include: {
                        constituency: true,
                        _count: { select: { candidates: true } },
                    },
                }),
                database_1.default.user.findUnique({
                    where: { id: userId },
                    select: { constituencyId: true, isVerified: true, isActive: true, role: true },
                }),
                database_1.default.voteReceipt.findFirst({
                    where: { electionId: String(req.params.id), userId },
                    select: { receiptHash: true, castedAt: true },
                }),
            ]);
            if (!election)
                return (0, response_1.sendError)(res, 404, 'Election not found');
            const now = new Date();
            const isEligible = user?.role === 'VOTER' &&
                user?.isVerified &&
                user?.isActive &&
                Boolean(user?.constituencyId) &&
                (!election.constituencyId || election.constituencyId === user?.constituencyId);
            return (0, response_1.sendSuccess)(res, 200, 'Election fetched', {
                election: {
                    id: election.id,
                    title: election.title,
                    description: election.description,
                    type: election.type,
                    status: election.status,
                    startDate: election.startDate,
                    endDate: election.endDate,
                    resultsPublishedAt: election.resultsPublishedAt,
                    candidateCount: election._count.candidates,
                    isEligible,
                    hasVoted: Boolean(receipt),
                    canVoteNow: isEligible &&
                        !receipt &&
                        election.status === 'ACTIVE' &&
                        election.startDate <= now &&
                        election.endDate >= now,
                    canViewResults: election.status === 'RESULTS_PUBLISHED',
                    receiptHash: receipt?.receiptHash || null,
                    castedAt: receipt?.castedAt || null,
                    constituency: election.constituency
                        ? {
                            id: election.constituency.id,
                            name: election.constituency.name,
                            code: election.constituency.code,
                            type: election.constituency.type,
                        }
                        : null,
                },
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id/candidates
    getCandidates: async (req, res) => {
        try {
            const election = await database_1.default.election.findUnique({
                where: { id: String(req.params.id) },
                select: { status: true },
            });
            if (!election) {
                return (0, response_1.sendError)(res, 404, 'Election not found');
            }
            const canShowResults = election.status === 'RESULTS_PUBLISHED';
            const candidates = await database_1.default.candidate.findMany({
                where: { electionId: String(req.params.id), status: 'APPROVED' },
                include: {
                    user: { select: { email: true, fatherName: true, photoUrl: true } },
                    profile: true,
                    voteCount: true
                },
                orderBy: { createdAt: 'asc' },
            });
            return (0, response_1.sendSuccess)(res, 200, 'Candidates fetched', {
                candidates: candidates.map((candidate) => ({
                    id: candidate.id,
                    electionId: candidate.electionId,
                    displayName: candidate.user.fatherName?.trim() || candidate.user.email.split('@')[0],
                    partyLabel: candidate.profile?.experience?.trim() || 'Independent',
                    photoUrl: candidate.profile?.photoUrl || candidate.user.photoUrl || null,
                    manifestoSummary: candidate.profile?.manifesto || null,
                    profileViews: candidate.profile?.profileViews || 0,
                    voteCount: canShowResults ? candidate.voteCount?.count ?? 0 : null,
                    votePercentage: null,
                    rank: null,
                })),
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/elections/:id/results — uses materialized view with CandidateVoteCount fallback
    getResults: async (req, res) => {
        try {
            const electionId = String(req.params.id);
            const election = await database_1.default.election.findUnique({
                where: { id: electionId },
                include: { constituency: true, _count: { select: { candidates: true } } },
            });
            if (!election) {
                return (0, response_1.sendError)(res, 404, 'Election not found');
            }
            if (election.status !== 'RESULTS_PUBLISHED') {
                return (0, response_1.sendError)(res, 403, 'Results are not published yet');
            }
            // Attempt to refresh the materialized view (non-blocking best-effort)
            try {
                await database_1.default.$executeRaw `REFRESH MATERIALIZED VIEW "ElectionResults"`;
            }
            catch (_) {
                // View may not support concurrent refresh or doesn't exist yet — continue
            }
            const [rawResults, totalVotes, candidates, totalEligible] = await Promise.all([
                database_1.default.$queryRaw `
          SELECT * FROM "ElectionResults"
          WHERE "electionId" = ${electionId}::uuid
          ORDER BY "rank" ASC
        `.catch(() => []),
                database_1.default.voteReceipt.count({ where: { electionId } }),
                database_1.default.candidate.findMany({
                    where: { electionId, status: 'APPROVED' },
                    include: {
                        user: { select: { email: true, fatherName: true, photoUrl: true } },
                        profile: true,
                        voteCount: true,
                    },
                    orderBy: { createdAt: 'asc' },
                }),
                database_1.default.user.count({
                    where: {
                        role: 'VOTER',
                        isVerified: true,
                        ...(election.constituencyId && { constituencyId: election.constituencyId }),
                    },
                }),
            ]);
            let results;
            if (rawResults && rawResults.length > 0) {
                // Happy path: materialized view has data
                results = rawResults.map((result) => {
                    const candidate = candidates.find((c) => c.id === result.candidateId);
                    return {
                        id: candidate?.id || result.candidateId,
                        electionId,
                        displayName: candidate
                            ? candidate.user.fatherName?.trim() || candidate.user.email.split('@')[0]
                            : 'Candidate',
                        partyLabel: candidate?.profile?.experience?.trim() || 'Independent',
                        photoUrl: candidate?.profile?.photoUrl || candidate?.user.photoUrl || null,
                        manifestoSummary: candidate?.profile?.manifesto || null,
                        profileViews: candidate?.profile?.profileViews || 0,
                        voteCount: Number(result.voteCount ?? 0),
                        votePercentage: Number(result.votePercentage ?? 0),
                        rank: Number(result.rank ?? 0),
                    };
                });
            }
            else {
                // Fallback: derive results directly from CandidateVoteCount (view not refreshed yet)
                const sorted = [...candidates].sort((a, b) => (b.voteCount?.count ?? 0) - (a.voteCount?.count ?? 0));
                const total = sorted.reduce((sum, c) => sum + (c.voteCount?.count ?? 0), 0);
                results = sorted.map((candidate, index) => {
                    const count = candidate.voteCount?.count ?? 0;
                    return {
                        id: candidate.id,
                        electionId,
                        displayName: candidate.user.fatherName?.trim() || candidate.user.email.split('@')[0],
                        partyLabel: candidate.profile?.experience?.trim() || 'Independent',
                        photoUrl: candidate.profile?.photoUrl || candidate.user.photoUrl || null,
                        manifestoSummary: candidate.profile?.manifesto || null,
                        profileViews: candidate.profile?.profileViews || 0,
                        voteCount: count,
                        votePercentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
                        rank: index + 1,
                    };
                });
            }
            return (0, response_1.sendSuccess)(res, 200, 'Results fetched', {
                results,
                totalVotes,
                totalEligible,
                turnoutPercentage: totalEligible > 0 ? Number(((totalVotes / totalEligible) * 100).toFixed(1)) : 0,
                election: {
                    id: election.id,
                    title: election.title,
                    description: election.description,
                    type: election.type,
                    status: election.status,
                    startDate: election.startDate,
                    endDate: election.endDate,
                    resultsPublishedAt: election.resultsPublishedAt,
                    candidateCount: election._count.candidates,
                    isEligible: false,
                    hasVoted: false,
                    canVoteNow: false,
                    canViewResults: true,
                    constituency: election.constituency
                        ? {
                            id: election.constituency.id,
                            name: election.constituency.name,
                            code: election.constituency.code,
                            type: election.constituency.type,
                        }
                        : null,
                },
            });
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
                database_1.default.user.count({
                    where: {
                        role: 'VOTER',
                        isVerified: true,
                        constituency: {
                            elections: { some: { id: electionId } }
                        }
                    }
                }),
                // Total who voted
                database_1.default.voteReceipt.count({ where: { electionId } }),
                // Votes by hour for turnout chart
                database_1.default.$queryRaw `
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
    // POST /api/elections  [ADMIN only]
    create: async (req, res) => {
        try {
            const { title, description, constituencyId, type, startDate, endDate, candidateIds, adminToken } = req.body;
            const createdBy = req.user.userId;
            // Validate ECP Admin Token
            const expectedToken = process.env.ADMIN_TOKEN || 'ECP-ADMIN-2026';
            if (adminToken !== expectedToken) {
                return (0, response_1.sendError)(res, 403, 'Invalid admin token. Launch unauthorized.');
            }
            if (!title?.trim())
                return (0, response_1.sendError)(res, 400, 'Election title is required');
            if (!type)
                return (0, response_1.sendError)(res, 400, 'Election type is required');
            if (!startDate || !endDate)
                return (0, response_1.sendError)(res, 400, 'Start and end dates are required');
            if (new Date(startDate) >= new Date(endDate)) {
                return (0, response_1.sendError)(res, 400, 'Start date must be before end date');
            }
            const election = await database_1.default.election.create({
                data: { title, description, constituencyId: constituencyId || null, type, startDate, endDate, createdBy }
            });
            // Link provided candidate IDs to this election
            if (Array.isArray(candidateIds) && candidateIds.length > 0) {
                await database_1.default.candidate.updateMany({
                    where: { id: { in: candidateIds } },
                    data: { electionId: election.id }
                });
            }
            await (0, auditLog_1.auditLog)({ action: 'ELECTION_CREATED', entity: 'Election', entityId: election.id, actorId: createdBy, metadata: { candidateCount: candidateIds?.length || 0 } });
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
            const election = await database_1.default.election.findUnique({ where: { id: String(req.params.id) } });
            if (!election)
                return (0, response_1.sendError)(res, 404, 'Election not found');
            if (!validTransitions[election.status]?.includes(status)) {
                return (0, response_1.sendError)(res, 400, `Cannot transition from ${election.status} to ${status}`);
            }
            const updated = await database_1.default.election.update({
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
    },
    // PATCH /api/elections/:id  [ADMIN only]
    update: async (req, res) => {
        try {
            const { title, description, constituencyId, type, startDate, endDate } = req.body;
            const actorId = req.user.userId;
            const electionId = String(req.params.id);
            const election = await database_1.default.election.findUnique({ where: { id: electionId } });
            if (!election)
                return (0, response_1.sendError)(res, 404, 'Election not found');
            // Only allow editing elections that are not yet ACTIVE, CLOSED, or RESULTS_PUBLISHED
            if (['ACTIVE', 'CLOSED', 'RESULTS_PUBLISHED'].includes(election.status)) {
                return (0, response_1.sendError)(res, 400, `Cannot edit an election with status: ${election.status}`);
            }
            if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
                return (0, response_1.sendError)(res, 400, 'Start date must be before end date');
            }
            const updated = await database_1.default.election.update({
                where: { id: electionId },
                data: {
                    ...(title && { title }),
                    ...(description !== undefined && { description }),
                    ...(constituencyId !== undefined && { constituencyId: constituencyId || null }),
                    ...(type && { type }),
                    ...(startDate && { startDate: new Date(startDate) }),
                    ...(endDate && { endDate: new Date(endDate) }),
                },
                include: { constituency: true }
            });
            await (0, auditLog_1.auditLog)({ action: 'ELECTION_UPDATED', entity: 'Election', entityId: electionId, actorId, metadata: req.body });
            return (0, response_1.sendSuccess)(res, 200, 'Election updated', { election: updated });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
