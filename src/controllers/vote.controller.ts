import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../utils/response';
import { auditLog } from '../utils/auditLog';

const prisma = new PrismaClient();

export const voteController = {

  // POST /api/votes — the most critical endpoint
  castVote: async (req: Request, res: Response) => {
    try {
      const { electionId, candidateId } = req.body;
      const userId = (req as any).user.userId;

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
      prisma.$executeRaw`SELECT refresh_election_results()`.catch(() => {});

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
