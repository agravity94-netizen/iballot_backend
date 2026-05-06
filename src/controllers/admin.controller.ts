import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response';

const prisma = new PrismaClient();

export const adminController = {
  // GET /api/admin/voters
  getVoters: async (req: Request, res: Response) => {
    try {
      const voters = await prisma.user.findMany({
        where: { role: 'VOTER' },
        include: { constituency: true },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'Voters fetched successfully', {
        voters: voters.map((v: any) => ({
          id: v.id,
          name: v.email.split('@')[0], // Fallback if name not in model, or use email
          cnic: v.cnic,
          constituency: v.constituency?.name || 'N/A',
          status: v.isActive ? (v.isVerified ? 'Verified' : 'Pending') : 'Suspended',
        }))
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/admin/stats
  getDashboardStats: async (req: Request, res: Response) => {
    try {
      const [voterCount, activeElectionCount, totalVotes, pendingVoters, pendingCandidates, turnoutData] = await Promise.all([
        prisma.user.count({ where: { role: 'VOTER' } }),
        prisma.election.count({ where: { status: 'ACTIVE' } }),
        prisma.voteReceipt.count(),
        // Pending Voters
        prisma.user.findMany({
          where: { isVerified: false, role: 'VOTER' },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        // Pending Candidates
        prisma.candidate.findMany({
          where: { status: 'PENDING' },
          include: { user: true },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        // Global Turnout by hour
        prisma.$queryRaw<any[]>`
          SELECT 
            DATE_TRUNC('hour', "castedAt") AS hour, 
            COUNT(*)::int AS count 
          FROM "VoteReceipt" 
          GROUP BY hour 
          ORDER BY hour DESC 
          LIMIT 10
        `
      ]);

      return sendSuccess(res, 200, 'Stats fetched', {
        voterCount,
        activeElectionCount,
        totalVotes,
        turnout: voterCount > 0 ? ((totalVotes / voterCount) * 100).toFixed(1) : 0,
        pendingApprovals: [
          ...pendingVoters.map((v: any) => ({ id: v.id, name: v.email.split('@')[0], type: 'VOTER_VERIFICATION', initials: v.email.substring(0, 2).toUpperCase() })),
          ...pendingCandidates.map((c: any) => ({ id: c.id, name: c.user.email.split('@')[0], type: 'CANDIDATE_APPROVAL', initials: c.user.email.substring(0, 2).toUpperCase() }))
        ],
        hourlyTurnout: turnoutData.reverse().map((d: any) => d.count)
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // PATCH /api/admin/voters/:id/status
  updateVoterStatus: async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const { id } = req.params;

      const isActive = status !== 'Suspended';

      const user = await prisma.user.update({
        where: { id: id as string },
        data: { isActive }
      });

      return sendSuccess(res, 200, `Voter status updated to ${status}`, { user });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
