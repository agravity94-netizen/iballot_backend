"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const cloudinary_service_1 = require("../services/cloudinary.service");
const auditLog_1 = require("../utils/auditLog");
const getDisplayName = (user) => user.fatherName?.trim() || user.email.split('@')[0];
const mapCandidateSummary = (candidate, canShowResults = false) => ({
    id: candidate.id,
    electionId: candidate.electionId,
    displayName: getDisplayName(candidate.user),
    partyLabel: candidate.profile?.experience?.trim() || 'Independent',
    photoUrl: candidate.profile?.photoUrl || candidate.user.photoUrl || null,
    manifestoSummary: candidate.profile?.manifesto || null,
    profileViews: candidate.profile?.profileViews || 0,
    voteCount: canShowResults ? candidate.voteCount?.count ?? 0 : null,
    votePercentage: canShowResults && candidate.votePercentage != null ? candidate.votePercentage : null,
    rank: canShowResults && candidate.rank != null ? candidate.rank : null,
});
exports.candidateController = {
    getAll: async (_req, res) => {
        try {
            const candidates = await database_1.default.candidate.findMany({
                where: { status: 'APPROVED' },
                include: {
                    user: { select: { email: true, fatherName: true, photoUrl: true } },
                    profile: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return (0, response_1.sendSuccess)(res, 200, 'Candidates fetched', {
                candidates: candidates.map((candidate) => mapCandidateSummary(candidate)),
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getMetadata: async (_req, res) => {
        try {
            const parties = await database_1.default.party.findMany({ orderBy: { name: 'asc' } });
            const constituencies = await database_1.default.constituency.findMany({
                orderBy: { code: 'asc' },
                include: { city: true }
            });
            const activeElections = await database_1.default.election.findMany({
                where: { status: { in: ['PUBLISHED', 'ACTIVE'] } },
                orderBy: { startDate: 'desc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Metadata fetched', { parties, constituencies, activeElections });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getMyApplications: async (req, res) => {
        try {
            const userId = req.user.userId;
            const [applications, appeal] = await Promise.all([
                database_1.default.candidateApplication.findMany({
                    where: { userId },
                    include: { party: true, election: true },
                    orderBy: { createdAt: 'desc' }
                }),
                database_1.default.appeal.findFirst({
                    where: { userId, type: 'CANDIDATE_REJECTION', status: 'PENDING' }
                })
            ]);
            const mappedApplications = applications.map(app => {
                if (app.status === 'REJECTED' && appeal) {
                    return { ...app, status: 'APPEAL_PENDING' };
                }
                return app;
            });
            return (0, response_1.sendSuccess)(res, 200, 'Applications fetched', { applications: mappedApplications });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getMe: async (req, res) => {
        try {
            const userId = req.user.userId;
            const candidate = await database_1.default.candidate.findFirst({
                where: { userId },
                include: {
                    user: { select: { email: true, fatherName: true, photoUrl: true, cnic: true } },
                    profile: true,
                    party: true,
                    election: { include: { constituency: true } }
                }
            });
            if (!candidate)
                return (0, response_1.sendError)(res, 404, 'You are not registered as a candidate.');
            return (0, response_1.sendSuccess)(res, 200, 'Candidate profile fetched', { candidate });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    apply: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { electionId, partyId, constituencyId, degreeName, institution, experience, manifesto, noCriminalRecord, docs // Object with base64 strings: policeClearance, nominationForm, taxReturns, assetAffidavit, portraitPhoto
             } = req.body;
            // Basic validation
            if (!electionId || !partyId || !constituencyId) {
                return (0, response_1.sendError)(res, 400, 'Election, Party, and Constituency are required.');
            }
            // Check if already applied
            const existing = await database_1.default.candidateApplication.findFirst({
                where: { userId, electionId, status: 'PENDING' }
            });
            if (existing)
                return (0, response_1.sendError)(res, 409, 'You already have a pending application for this election.');
            const uploadDoc = async (base64, folder) => {
                if (!base64)
                    return null;
                const result = await cloudinary_service_1.cloudinaryService.uploadImage(`data:image/jpeg;base64,${base64}`, `iballot/candidate_apps/${folder}`);
                return result.success ? result.url : null;
            };
            // Upload files sequentially to avoid hitting rate limits or memory issues in some environments
            const policeClearanceUrl = await uploadDoc(docs?.policeClearance, 'police');
            const nominationFormUrl = await uploadDoc(docs?.nominationForm, 'forms');
            const taxReturnsUrl = await uploadDoc(docs?.taxReturns, 'tax');
            const assetAffidavitUrl = await uploadDoc(docs?.assetAffidavit, 'assets');
            const portraitPhotoUrl = await uploadDoc(docs?.portraitPhoto, 'portraits');
            const application = await database_1.default.candidateApplication.create({
                data: {
                    userId,
                    electionId,
                    partyId,
                    constituencyId,
                    degreeName,
                    institution,
                    experience,
                    manifesto,
                    noCriminalRecord: !!noCriminalRecord,
                    policeClearanceUrl,
                    nominationFormUrl,
                    taxReturnsUrl,
                    assetAffidavitUrl,
                    portraitPhotoUrl,
                    status: 'PENDING'
                }
            });
            await (0, auditLog_1.auditLog)({
                action: 'CANDIDATE_APPLICATION_SUBMITTED',
                entity: 'CandidateApplication',
                entityId: application.id,
                ipAddress: req.ip
            });
            return (0, response_1.sendSuccess)(res, 201, 'Application submitted successfully!', { application });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getById: async (req, res) => {
        try {
            const candidate = await database_1.default.candidate.findUnique({
                where: { id: String(req.params.id) },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fatherName: true,
                            photoUrl: true,
                            province: true,
                            city: true,
                        },
                    },
                    profile: true,
                    voteCount: true,
                    election: {
                        include: {
                            constituency: true,
                        },
                    },
                },
            });
            if (!candidate) {
                return (0, response_1.sendError)(res, 404, 'Candidate not found');
            }
            const canShowResults = candidate.election.status === 'RESULTS_PUBLISHED';
            return (0, response_1.sendSuccess)(res, 200, 'Candidate fetched', {
                candidate: {
                    ...mapCandidateSummary(candidate, canShowResults),
                    candidateUserId: candidate.user.id,
                    status: candidate.status,
                    experience: candidate.profile?.experience || null,
                    videoUrl: candidate.profile?.videoUrl || null,
                    manifesto: candidate.profile?.manifesto || null,
                    promises: candidate.profile?.promises || [],
                    constituency: candidate.election.constituency
                        ? {
                            id: candidate.election.constituency.id,
                            name: candidate.election.constituency.name,
                            code: candidate.election.constituency.code,
                            type: candidate.election.constituency.type,
                        }
                        : null,
                    election: {
                        id: candidate.election.id,
                        title: candidate.election.title,
                        status: candidate.election.status,
                        startDate: candidate.election.startDate,
                        endDate: candidate.election.endDate,
                    },
                },
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    compare: async (req, res) => {
        try {
            const rawIds = req.query.ids;
            const ids = Array.isArray(rawIds) ? rawIds.map(String) : typeof rawIds === 'string' ? [rawIds] : [];
            if (ids.length !== 2) {
                return (0, response_1.sendError)(res, 400, 'Exactly two candidate ids are required');
            }
            const candidates = await database_1.default.candidate.findMany({
                where: { id: { in: ids } },
                include: {
                    user: { select: { id: true, email: true, fatherName: true, photoUrl: true } },
                    profile: true,
                    voteCount: true,
                    election: { include: { constituency: true } },
                },
            });
            if (candidates.length !== 2) {
                return (0, response_1.sendError)(res, 404, 'One or more candidates were not found');
            }
            const [first] = candidates;
            const sameElection = candidates.every((candidate) => candidate.electionId === first.electionId);
            if (!sameElection) {
                return (0, response_1.sendError)(res, 400, 'Candidates must belong to the same election');
            }
            const canShowResults = first.election.status === 'RESULTS_PUBLISHED';
            return (0, response_1.sendSuccess)(res, 200, 'Candidate comparison fetched', {
                comparison: {
                    electionId: first.election.id,
                    electionTitle: first.election.title,
                    candidates: candidates.map((candidate) => ({
                        ...mapCandidateSummary(candidate, canShowResults),
                        candidateUserId: candidate.user.id,
                        status: candidate.status,
                        experience: candidate.profile?.experience || null,
                        videoUrl: candidate.profile?.videoUrl || null,
                        manifesto: candidate.profile?.manifesto || null,
                        promises: candidate.profile?.promises || [],
                        constituency: candidate.election.constituency
                            ? {
                                id: candidate.election.constituency.id,
                                name: candidate.election.constituency.name,
                                code: candidate.election.constituency.code,
                                type: candidate.election.constituency.type,
                            }
                            : null,
                        election: {
                            id: candidate.election.id,
                            title: candidate.election.title,
                            status: candidate.election.status,
                            startDate: candidate.election.startDate,
                            endDate: candidate.election.endDate,
                        },
                    })),
                },
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getApplicationById: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;
            const [application, appeal] = await Promise.all([
                database_1.default.candidateApplication.findFirst({
                    where: { id: String(id), userId: String(userId) },
                    include: { party: true, election: true }
                }),
                database_1.default.appeal.findFirst({
                    where: { userId, type: 'CANDIDATE_REJECTION', status: 'PENDING' }
                })
            ]);
            if (!application)
                return (0, response_1.sendError)(res, 404, 'Application not found.');
            const mappedApplication = application.status === 'REJECTED' && appeal
                ? { ...application, status: 'APPEAL_PENDING' }
                : application;
            return (0, response_1.sendSuccess)(res, 200, 'Application fetched', { application: mappedApplication });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
};
