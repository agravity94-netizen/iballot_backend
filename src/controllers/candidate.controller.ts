import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response';

const prisma = new PrismaClient();

export const candidateController = {
  // GET /api/candidates
  getAll: async (req: Request, res: Response) => {
    try {
      // For election creation, we want all APPROVED candidates
      const candidates = await prisma.candidate.findMany({
        where: { status: 'APPROVED' },
        include: {
          user: {
            select: {
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'All approved candidates fetched', {
        candidates: candidates.map((c: any) => ({
          id: c.id,
          name: c.name || c.user?.email.split('@')[0] || 'Unknown',
          party: c.party || 'Independent',
          color: c.color || '#64748b',
          status: c.status
        }))
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
