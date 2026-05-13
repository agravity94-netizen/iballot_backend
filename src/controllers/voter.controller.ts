import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendError, sendSuccess } from '../utils/response';

export const voterController = {
  getHistory: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const history = await prisma.voteReceipt.findMany({
        where: { userId },
        include: {
          election: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { castedAt: 'desc' },
      });

      return sendSuccess(res, 200, 'Voting history fetched', {
        history: history.map((item) => ({
          electionId: item.election.id,
          electionTitle: item.election.title,
          electionStatus: item.election.status,
          castedAt: item.castedAt,
          receiptHash: item.receiptHash,
          resultsPublished: item.election.status === 'RESULTS_PUBLISHED',
          canViewResults: item.election.status === 'RESULTS_PUBLISHED',
        })),
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },
};
