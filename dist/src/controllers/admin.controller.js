"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
exports.adminController = {
    // GET /api/admin/voters
    getVoters: async (req, res) => {
        try {
            const voters = await database_1.default.user.findMany({
                where: { role: 'VOTER' },
                include: { constituency: true },
                orderBy: { createdAt: 'desc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Voters fetched successfully', {
                voters: voters.map((v) => ({
                    id: v.id,
                    name: v.email.split('@')[0], // Fallback if name not in model, or use email
                    cnic: v.cnic,
                    constituency: v.constituency?.name || 'N/A',
                    status: v.isActive ? (v.isVerified ? 'Verified' : 'Pending') : 'Suspended',
                }))
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/admin/stats
    getDashboardStats: async (req, res) => {
        try {
            const [voterCount, activeElectionCount, totalVotes, pendingVoters, pendingCandidates, pendingAppealCount, turnoutData] = await Promise.all([
                database_1.default.user.count({ where: { role: 'VOTER' } }),
                database_1.default.election.count({ where: { status: 'ACTIVE' } }),
                database_1.default.voteReceipt.count(),
                // Pending Voters
                database_1.default.user.findMany({
                    where: { isVerified: false, role: 'VOTER' },
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }),
                // Pending Candidates
                database_1.default.candidate.findMany({
                    where: { status: 'PENDING' },
                    include: { user: true },
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }),
                // Pending Appeals
                database_1.default.appeal.count({ where: { status: 'PENDING' } }),
                // Global Turnout by hour
                database_1.default.$queryRaw `
          SELECT 
            DATE_TRUNC('hour', "castedAt") AS hour, 
            COUNT(*)::int AS count 
          FROM "VoteReceipt" 
          GROUP BY hour 
          ORDER BY hour DESC 
          LIMIT 10
        `
            ]);
            return (0, response_1.sendSuccess)(res, 200, 'Stats fetched', {
                voterCount,
                activeElectionCount,
                totalVotes,
                pendingAppealCount,
                turnout: voterCount > 0 ? ((totalVotes / voterCount) * 100).toFixed(1) : 0,
                pendingApprovals: [
                    ...pendingVoters.map((v) => ({ id: v.id, name: v.email.split('@')[0], type: 'VOTER_VERIFICATION', initials: v.email.substring(0, 2).toUpperCase() })),
                    ...pendingCandidates.map((c) => ({ id: c.id, name: c.user.email.split('@')[0], type: 'CANDIDATE_APPROVAL', initials: c.user.email.substring(0, 2).toUpperCase() }))
                ],
                hourlyTurnout: turnoutData.reverse().map((d) => d.count)
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // PATCH /api/admin/voters/:id/status
    updateVoterStatus: async (req, res) => {
        try {
            const id = req.params.id;
            const { status } = req.body;
            const actorId = req.user.userId;
            let isActive = true;
            let isVerified = false;
            if (status === 'Verified') {
                isActive = true;
                isVerified = true;
            }
            else if (status === 'Suspended') {
                isActive = false;
                // Suspension revokes verification
                isVerified = false;
            }
            else if (status === 'Pending') {
                isActive = true;
                isVerified = false;
            }
            const user = await database_1.default.user.update({
                where: { id },
                data: { isActive, isVerified }
            });
            await (0, auditLog_1.auditLog)({ action: `VOTER_${status.toUpperCase()}`, entity: 'User', entityId: id, actorId });
            return (0, response_1.sendSuccess)(res, 200, `Voter status updated to ${status}`, { user });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/admin/candidates
    // Returns ALL candidate applications (PENDING, APPROVED, REJECTED)
    getCandidates: async (req, res) => {
        try {
            const { status, constituencyId } = req.query;
            const applications = await database_1.default.candidateApplication.findMany({
                where: {
                    ...(status && { status: status }),
                    ...(constituencyId && { constituencyId: constituencyId }),
                },
                include: {
                    user: true,
                    election: {
                        select: { id: true, title: true, type: true }
                    },
                    party: true
                },
                orderBy: { createdAt: 'desc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Applications fetched', {
                candidates: applications.map((app) => ({
                    id: app.id,
                    status: app.status,
                    constituencyId: app.constituencyId,
                    createdAt: app.createdAt,
                    election: app.election,
                    party: app.party,
                    user: {
                        id: app.user.id,
                        name: app.user.email.split('@')[0],
                        email: app.user.email,
                        cnic: app.user.cnic,
                        phone: app.user.phone,
                        photoUrl: app.user.photoUrl,
                        province: app.user.province,
                        city: app.user.city,
                        fatherName: app.user.fatherName,
                        constituencyId: app.user.constituencyId,
                    },
                    profile: {
                        manifesto: app.manifesto,
                        experience: app.experience,
                        photoUrl: app.portraitPhotoUrl,
                        degree: app.degreeName,
                        institution: app.institution
                    }
                }))
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // PATCH /api/admin/candidates/:id/status
    // Approve or reject a candidate application
    updateCandidateStatus: async (req, res) => {
        try {
            const id = req.params.id;
            const { status, rejectionReason } = req.body;
            const actorId = req.user.userId;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return (0, response_1.sendError)(res, 400, 'Status must be APPROVED or REJECTED');
            }
            const application = await database_1.default.candidateApplication.findUnique({
                where: { id },
                include: { user: true }
            });
            if (!application)
                return (0, response_1.sendError)(res, 404, 'Application not found');
            if (application.status !== 'PENDING') {
                return (0, response_1.sendError)(res, 400, `Application is already ${application.status}`);
            }
            // 1. Update Application status
            const updatedApp = await database_1.default.candidateApplication.update({
                where: { id },
                data: {
                    status,
                    adminNotes: rejectionReason || null,
                }
            });
            // 2. If APPROVED, create the official Candidate record
            if (status === 'APPROVED') {
                // Create Candidate
                const candidate = await database_1.default.candidate.create({
                    data: {
                        userId: application.userId,
                        electionId: application.electionId,
                        partyId: application.partyId,
                        status: 'APPROVED',
                        approvedBy: actorId,
                        approvedAt: new Date(),
                    }
                });
                // Create Profile
                await database_1.default.candidateProfile.create({
                    data: {
                        candidateId: candidate.id,
                        manifesto: application.manifesto,
                        experience: application.experience,
                        photoUrl: application.portraitPhotoUrl,
                    }
                });
                // Update User role (optional but recommended)
                await database_1.default.user.update({
                    where: { id: application.userId },
                    data: { role: 'CANDIDATE' }
                });
            }
            // 3. Create notification for candidate
            await database_1.default.notification.create({
                data: {
                    userId: application.userId,
                    type: status === 'APPROVED' ? 'CANDIDATE_APPROVED' : 'FRAUD_ALERT',
                    title: status === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
                    message: status === 'APPROVED'
                        ? 'Your candidacy application has been approved. You are now an official candidate.'
                        : `Your candidacy application has been rejected. Reason: ${rejectionReason || 'See official communication.'}`,
                }
            });
            await (0, auditLog_1.auditLog)({
                action: `CANDIDATE_${status}`,
                entity: 'CandidateApplication',
                entityId: id,
                actorId,
                metadata: { rejectionReason: rejectionReason || null }
            });
            return (0, response_1.sendSuccess)(res, 200, `Application ${status.toLowerCase()}`, { application: updatedApp });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/admin/fraud-alerts
    getFraudAlerts: async (req, res) => {
        try {
            const { resolved } = req.query;
            const alerts = await database_1.default.fraudAlert.findMany({
                where: {
                    ...(resolved !== undefined && { isResolved: resolved === 'true' }),
                },
                include: {
                    user: { select: { id: true, email: true, cnic: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });
            const counts = await database_1.default.fraudAlert.groupBy({
                by: ['severity'],
                _count: { severity: true },
                where: { isResolved: false },
            });
            const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
            counts.forEach((c) => {
                severityCounts[c.severity] = c._count.severity;
            });
            return (0, response_1.sendSuccess)(res, 200, 'Fraud alerts fetched', { alerts, severityCounts });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // PATCH /api/admin/fraud-alerts/:id/resolve
    resolveFraudAlert: async (req, res) => {
        try {
            const id = req.params.id;
            const actorId = req.user.userId;
            const alert = await database_1.default.fraudAlert.findUnique({ where: { id } });
            if (!alert)
                return (0, response_1.sendError)(res, 404, 'Alert not found');
            if (alert.isResolved)
                return (0, response_1.sendError)(res, 400, 'Alert already resolved');
            const updated = await database_1.default.fraudAlert.update({
                where: { id },
                data: { isResolved: true, resolvedBy: actorId }
            });
            await (0, auditLog_1.auditLog)({ action: 'FRAUD_ALERT_RESOLVED', entity: 'FraudAlert', entityId: id, actorId });
            return (0, response_1.sendSuccess)(res, 200, 'Alert resolved', { alert: updated });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    deleteVoter: async (req, res) => {
        try {
            const id = req.params.id;
            const actorId = req.user.userId;
            const user = await database_1.default.user.findUnique({
                where: { id },
            });
            if (!user) {
                return (0, response_1.sendError)(res, 404, 'Voter not found');
            }
            // Delete associated vote receipts first due to Restrict onDelete constraint
            await database_1.default.voteReceipt.deleteMany({
                where: { userId: id }
            });
            // Delete the user record
            await database_1.default.user.delete({
                where: { id }
            });
            await (0, auditLog_1.auditLog)({
                action: 'VOTER_DELETED',
                entity: 'User',
                entityId: id,
                actorId,
                metadata: { deletedUserEmail: user.email, deletedUserCnic: user.cnic }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Voter deleted successfully');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
};
