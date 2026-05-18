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
          if (appeal.type === 'CANDIDATE_REJECTION') {
            // Find the latest rejected candidate application for this user
            const application = await tx.candidateApplication.findFirst({
              where: { userId: appeal.userId, status: 'REJECTED' },
              orderBy: { createdAt: 'desc' }
            });

            if (application) {
              // 1. Update CandidateApplication status to APPROVED
              await tx.candidateApplication.update({
                where: { id: application.id },
                data: { status: 'APPROVED', adminNotes: 'Appeal granted by ECP.' }
              });

              // 2. Upsert the official Candidate record
              const candidate = await tx.candidate.upsert({
                where: { userId: appeal.userId },
                create: {
                  userId: appeal.userId,
                  electionId: application.electionId,
                  partyId: application.partyId,
                  status: 'APPROVED',
                  approvedBy: actorId,
                  approvedAt: new Date(),
                },
                update: {
                  status: 'APPROVED',
                  approvedBy: actorId,
                  approvedAt: new Date()
                }
              });

              // 3. Upsert the CandidateProfile
              await tx.candidateProfile.upsert({
                where: { candidateId: candidate.id },
                create: {
                  candidateId: candidate.id,
                  manifesto: application.manifesto,
                  experience: application.experience,
                  photoUrl: application.portraitPhotoUrl,
                },
                update: {
                  manifesto: application.manifesto,
                  experience: application.experience,
                  photoUrl: application.portraitPhotoUrl,
                }
              });

              // 4. Update User role to CANDIDATE
              await tx.user.update({
                where: { id: appeal.userId },
                data: { role: 'CANDIDATE' }
              });
            }
          } else if (appeal.type === 'VOTER_REJECTION') {
            // Auto-verify voter
            await tx.user.update({
              where: { id: appeal.userId },
              data: { isVerified: true }
            });
          }
        }

        return result;
      }, {
        maxWait: 15000, // wait up to 15 seconds to obtain a connection lock
        timeout: 30000  // allow up to 30 seconds for transaction execution
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
      let { type, statement, evidence } = req.body;

      // Compatibility fallback layer for older/different portal payloads
      if (!type && req.body.applicationId) {
        type = 'CANDIDATE_REJECTION';
      }
      if (!statement && req.body.reason) {
        statement = req.body.reason;
      }
      if (!evidence && req.body.evidence) {
        evidence = Array.isArray(req.body.evidence) ? req.body.evidence : [req.body.evidence];
      }

      if (!type || !statement) {
        return sendError(res, 400, 'Appeal type and statement are required.');
      }

      const existing = await prisma.appeal.findFirst({
        where: { userId, type: type as any, status: 'PENDING' }
      });

      if (existing) return sendError(res, 400, 'You already have a pending appeal of this type');

      const appeal = await prisma.appeal.create({
        data: {
          userId,
          type: type as any,
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
