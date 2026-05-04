"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteController = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const response_1 = require("../utils/response");
const prisma = new client_1.PrismaClient();
exports.voteController = {
    // POST /api/votes — the most critical endpoint
    castVote: async (req, res) => {
        try {
            const { electionId, candidateId } = req.body;
            const userId = req.user.userId;
            // Generate unique receipt hash
            const receiptHash = crypto_1.default
                .createHash('sha256')
                .update(`${userId}-${electionId}-${Date.now()}-${crypto_1.default.randomBytes(16).toString('hex')}`)
                .digest('hex');
            // Use the stored procedure — handles all checks + atomicity
            const result = await prisma.$queryRaw `
        SELECT * FROM cast_vote(
          ${userId}::uuid,
          ${electionId}::uuid,
          ${candidateId}::uuid,
          ${receiptHash}::text
        )
      `;
            const voteResult = result[0];
            if (!voteResult.success) {
                // Log fraud attempt if duplicate
                if (voteResult.error?.includes('already voted')) {
                    await prisma.fraudAlert.create({
                        data: {
                            userId,
                            type: 'DUPLICATE_VOTE_ATTEMPT',
                            description: `User attempted duplicate vote in election ${electionId}`,
                            ipAddress: req.ip,
                            severity: 'HIGH'
                        }
                    });
                }
                return (0, response_1.sendError)(res, 400, voteResult.error || 'Vote failed');
            }
            // Refresh materialized view (non-blocking)
            prisma.$executeRaw `SELECT refresh_election_results()`.catch(() => { });
            return (0, response_1.sendSuccess)(res, 201, 'Vote cast successfully', {
                receiptHash: voteResult.receiptHash,
                castedAt: new Date()
            });
        }
        catch (err) {
            // Catch DB-level unique constraint violation as extra safety
            if (err.code === 'P2002') {
                return (0, response_1.sendError)(res, 400, 'You have already voted in this election');
            }
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/votes/receipt/:hash
    getReceipt: async (req, res) => {
        try {
            const userId = req.user.userId;
            const receipt = await prisma.voteReceipt.findFirst({
                where: {
                    receiptHash: String(req.params.hash),
                    userId // Ensure user can only see their own receipt
                },
                select: {
                    receiptHash: true,
                    electionId: true,
                    castedAt: true,
                    election: { select: { title: true } }
                }
            });
            if (!receipt)
                return (0, response_1.sendError)(res, 404, 'Receipt not found');
            return (0, response_1.sendSuccess)(res, 200, 'Receipt fetched', { receipt });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/votes/status/:electionId
    checkVoteStatus: async (req, res) => {
        try {
            const userId = req.user.userId;
            const receipt = await prisma.voteReceipt.findFirst({
                where: { userId, electionId: String(req.params.electionId) },
                select: { receiptHash: true, castedAt: true }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Vote status fetched', {
                hasVoted: !!receipt,
                ...(receipt && { receiptHash: receipt.receiptHash, castedAt: receipt.castedAt })
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
