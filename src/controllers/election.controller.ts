import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response';
import { auditLog } from '../utils/auditLog';

const prisma = new PrismaClient();

export const electionController = {

  // GET /api/elections
  getAll: async (req: Request, res: Response) => {
    try {
      const { status, constituencyId } = req.query;
      const userId = (req as any).user.userId;

      // Get user's constituency if not specified
      const user = await prisma.user.findUnique({ where: { id: userId } });

      const elections = await prisma.election.findMany({
        where: {
          ...(status && { status: status as any }),
          constituencyId: (constituencyId as string) || user?.constituencyId || undefined
        },
        include: {
          _count: { select: { candidates: true } }
        },
        orderBy: { startDate: 'desc' }
      });

      return sendSuccess(res, 200, 'Elections fetched', {
        elections: elections.map((e: any) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          status: e.status,
          startDate: e.startDate,
          endDate: e.endDate,
          candidateCount: e._count.candidates
        }))
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/elections/:id
  getById: async (req: Request, res: Response) => {
    try {
      const election = await prisma.election.findUnique({
        where: { id: String(req.params.id) },
        include: { constituency: true }
      });

      if (!election) return sendError(res, 404, 'Election not found');

      return sendSuccess(res, 200, 'Election fetched', { election });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/elections/:id/candidates
  getCandidates: async (req: Request, res: Response) => {
    try {
      const candidates = await prisma.candidate.findMany({
        where: { electionId: String(req.params.id), status: 'APPROVED' },
        include: {
          user: { select: { email: true } },
          profile: true,
          voteCount: true
        }
      });

      return sendSuccess(res, 200, 'Candidates fetched', { candidates });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/elections/:id/results — uses materialized view
  getResults: async (req: Request, res: Response) => {
    try {
      const results = await prisma.$queryRaw`
        SELECT * FROM "ElectionResults"
        WHERE "electionId" = ${String(req.params.id)}::uuid
        ORDER BY "rank" ASC
      `;

      const totalVotes = await prisma.voteReceipt.count({
        where: { electionId: String(req.params.id) }
      });

      return sendSuccess(res, 200, 'Results fetched', { results, totalVotes });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/elections/:id/analytics
  getAnalytics: async (req: Request, res: Response) => {
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
        prisma.$queryRaw`
          SELECT
            DATE_TRUNC('hour', "castedAt") AS hour,
            COUNT(*) AS votes
          FROM "VoteReceipt"
          WHERE "electionId" = ${electionId}::uuid
          GROUP BY hour
          ORDER BY hour ASC
        `
      ]);

      return sendSuccess(res, 200, 'Analytics fetched', {
        totalVoters,
        totalVoted,
        turnoutPercent: totalVoters > 0 ? ((totalVoted / totalVoters) * 100).toFixed(2) : 0,
        votesByHour
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/elections
  create: async (req: Request, res: Response) => {
    try {
      const { title, description, constituencyId, type, startDate, endDate } = req.body;
      const createdBy = (req as any).user.userId;

      if (new Date(startDate) >= new Date(endDate)) {
        return sendError(res, 400, 'Start date must be before end date');
      }

      const election = await prisma.election.create({
        data: { title, description, constituencyId, type, startDate, endDate, createdBy }
      });

      await auditLog({ action: 'ELECTION_CREATED', entity: 'Election', entityId: election.id, actorId: createdBy });

      return sendSuccess(res, 201, 'Election created', { election });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // PATCH /api/elections/:id/status
  updateStatus: async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const actorId = (req as any).user.userId;

      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PUBLISHED'],
        PUBLISHED: ['ACTIVE', 'DRAFT'],
        ACTIVE: ['PAUSED', 'CLOSED'],
        PAUSED: ['ACTIVE', 'CLOSED'],
        CLOSED: ['RESULTS_PUBLISHED']
      };

      const election = await prisma.election.findUnique({ where: { id: String(req.params.id) } });
      if (!election) return sendError(res, 404, 'Election not found');

      if (!validTransitions[election.status]?.includes(status)) {
        return sendError(res, 400, `Cannot transition from ${election.status} to ${status}`);
      }

      const updated = await prisma.election.update({
        where: { id: String(req.params.id) },
        data: {
          status,
          ...(status === 'RESULTS_PUBLISHED' && { resultsPublishedAt: new Date() })
        }
      });

      await auditLog({ action: `ELECTION_${status}`, entity: 'Election', entityId: election.id, actorId });

      return sendSuccess(res, 200, `Election ${status.toLowerCase()}`, { election: updated });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
