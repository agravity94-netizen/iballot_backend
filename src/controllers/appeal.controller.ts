import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { auditLog } from '../utils/auditLog';
import { emailService } from '../services/email.service';

export const appealController = {
  // GET /api/admin/appeals
  getAppeals: async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;

      const appeals = await prisma.appeal.findMany({
        where: {
          ...(status && { status: status as any }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              cnic: true,
              province: true,
              city: true,
              candidate: {
                include: {
                  election: { select: { title: true, type: true } }
                }
              }
            }
          },
          resolver: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'Appeals fetched successfully', { appeals });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/admin/appeals/:id
  getAppealById: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const appeal = await prisma.appeal.findUnique({
        where: { id },
        include: {
          user: {
            include: {
              candidate: {
                include: {
                  election: true,
                  profile: true
                }
              }
            }
          }
        }
      });

      if (!appeal) return sendError(res, 404, 'Appeal not found');

      return sendSuccess(res, 200, 'Appeal fetched', { appeal });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // PATCH /api/admin/appeals/:id/resolve
  resolveAppeal: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status, adminNotes } = req.body;
      const actorId = (req as any).user.userId as string;

      if (!['GRANTED', 'REJECTED'].includes(status)) {
        return sendError(res, 400, 'Status must be GRANTED or REJECTED');
      }

      // Fetch with include to satisfy TypeScript later
      const appeal = await prisma.appeal.findUnique({
        where: { id },
        include: { 
          user: { 
            include: { 
              candidate: true 
            } 
          } 
        }
      });

      if (!appeal) return sendError(res, 404, 'Appeal not found');
      if (appeal.status !== 'PENDING') return sendError(res, 400, 'Appeal already resolved');

      // Transaction to update appeal and auto-approve if granted
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.appeal.update({
          where: { id },
          data: {
            status,
            adminNotes,
            resolvedBy: actorId,
            resolvedAt: new Date(),
          }
        });

        if (status === 'GRANTED') {
          if (appeal.type === 'CANDIDATE_REJECTION' && appeal.user.candidate) {
            // Auto-approve candidate
            await tx.candidate.update({
              where: { id: appeal.user.candidate.id },
              data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() }
            });
          } else if (appeal.type === 'VOTER_REJECTION') {
            // Auto-verify voter
            await tx.user.update({
              where: { id: appeal.userId },
              data: { isVerified: true }
            });
          }
        }

        return result;
      });

      // Create notification in-app
      await prisma.notification.create({
        data: {
          userId: appeal.userId,
          type: 'APPEAL_RESOLVED',
          title: status === 'GRANTED' ? 'Appeal Granted' : 'Appeal Rejected',
          message: status === 'GRANTED' 
            ? 'Your appeal has been granted. Your status has been updated to Approved.'
            : 'Your appeal has been reviewed and rejected. The original decision stands.',
        }
      });

      // Send Email Notification
      await emailService.sendAppealResolution(appeal.user.email, status, adminNotes);

      await auditLog({
        action: `APPEAL_${status}`,
        entity: 'Appeal',
        entityId: id,
        actorId,
        metadata: { adminNotes }
      });

      return sendSuccess(res, 200, `Appeal ${status.toLowerCase()}`, { appeal: updated });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/appeals (For users to submit - will be used later)
  submitAppeal: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId as string;
      const { type, statement, evidence } = req.body;

      const existing = await prisma.appeal.findFirst({
        where: { userId, type, status: 'PENDING' }
      });

      if (existing) return sendError(res, 400, 'You already have a pending appeal of this type');

      const appeal = await prisma.appeal.create({
        data: {
          userId,
          type,
          statement,
          evidence: evidence || [],
        }
      });

      return sendSuccess(res, 201, 'Appeal submitted successfully', { appeal });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
