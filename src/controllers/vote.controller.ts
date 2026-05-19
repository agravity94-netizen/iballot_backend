import { Request, Response } from 'express';
import prisma from '../config/database';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../utils/response';
import { auditLog } from '../utils/auditLog';



export const voteController = {

  // POST /api/votes — the most critical endpoint
  castVote: async (req: Request, res: Response) => {
    try {
      const { electionId, candidateId } = req.body;
      const userId = (req as any).user.userId;

      const [user, election, candidate] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { constituencyId: true, isVerified: true, isActive: true, role: true },
        }),
        prisma.election.findUnique({
          where: { id: electionId },
          select: { id: true, title: true, status: true, startDate: true, endDate: true, constituencyId: true },
        }),
        prisma.candidate.findUnique({
          where: { id: candidateId },
          select: { id: true, electionId: true, status: true },
        }),
      ]);

      if (!user || user.role !== 'VOTER' || !user.isVerified || !user.isActive || !user.constituencyId) {
        return sendError(res, 403, 'You are not eligible to vote');
      }

      if (!election) {
        return sendError(res, 404, 'Election not found');
      }

      if (election.status !== 'ACTIVE') {
        return sendError(res, 400, 'Voting is not open for this election');
      }

      const now = new Date();
      if (election.startDate > now || election.endDate < now) {
        return sendError(res, 400, 'This election is outside the active voting window');
      }

      if (election.constituencyId && election.constituencyId !== user.constituencyId) {
        return sendError(res, 403, 'You are not eligible for this constituency election');
      }

      if (!candidate || candidate.electionId !== electionId || candidate.status !== 'APPROVED') {
        return sendError(res, 400, 'Selected candidate is not valid for this election');
      }

      // Generate unique receipt hash
      const receiptHash = crypto
        .createHash('sha256')
        .update(`${userId}-${electionId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`)
        .digest('hex');

      // Use the stored procedure — handles all checks + atomicity
      const result = await prisma.$queryRaw<{ success: boolean; error?: string; receiptHash?: string }[]>`
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
        return sendError(res, 400, voteResult.error || 'Vote failed');
      }

      // Refresh materialized view (non-blocking)
      prisma.$executeRaw`SELECT refresh_election_results()`.catch(() => { });

      await auditLog({
        action: 'VOTE_CAST',
        entity: 'Election',
        entityId: electionId,
        actorId: userId,
        ipAddress: req.ip,
        metadata: {
          receiptHash: voteResult.receiptHash,
          electionTitle: election?.title || 'Unknown Election'
        }
      });

      return sendSuccess(res, 201, 'Vote cast successfully', {
        receiptHash: voteResult.receiptHash,
        castedAt: new Date()
      });

    } catch (err: any) {
      // Catch DB-level unique constraint violation as extra safety
      if (err.code === 'P2002') {
        return sendError(res, 400, 'You have already voted in this election');
      }
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/votes/receipt/:hash
  getReceipt: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

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

      if (!receipt) return sendError(res, 404, 'Receipt not found');

      return sendSuccess(res, 200, 'Receipt fetched', { receipt });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/votes/status/:electionId
  checkVoteStatus: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const receipt = await prisma.voteReceipt.findFirst({
        where: { userId, electionId: String(req.params.electionId) },
        select: { receiptHash: true, castedAt: true }
      });

      return sendSuccess(res, 200, 'Vote status fetched', {
        hasVoted: !!receipt,
        ...(receipt && { receiptHash: receipt.receiptHash, castedAt: receipt.castedAt })
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
