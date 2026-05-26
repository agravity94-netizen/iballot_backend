import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { auditLog } from '../utils/auditLog';

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
      const [voterCount, activeElectionCount, totalVotes, pendingVoters, pendingCandidates, pendingAppealCount, turnoutData] = await Promise.all([
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
        // Pending Appeals
        prisma.appeal.count({ where: { status: 'PENDING' } }),
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
        pendingAppealCount,
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
      const id = req.params.id as string;
      const { status } = req.body;
      const actorId = (req as any).user.userId;

      let isActive = true;
      let isVerified = false;

      if (status === 'Verified') {
        isActive = true;
        isVerified = true;
      } else if (status === 'Suspended') {
        isActive = false;
        // Suspension revokes verification
        isVerified = false;
      } else if (status === 'Pending') {
        isActive = true;
        isVerified = false;
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive, isVerified }
      });

      await auditLog({ action: `VOTER_${status.toUpperCase()}`, entity: 'User', entityId: id, actorId });

      return sendSuccess(res, 200, `Voter status updated to ${status}`, { user });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/admin/candidates
  // Returns ALL candidate applications (PENDING, APPROVED, REJECTED)
  getCandidates: async (req: Request, res: Response) => {
    try {
      const { status, constituencyId } = req.query;

      const applications = await prisma.candidateApplication.findMany({
        where: {
          ...(status && { status: status as any }),
          ...(constituencyId && { constituencyId: constituencyId as string }),
        },
        include: {
          user: true,
          election: {
            select: { id: true, title: true, type: true }
          },
          party: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return sendSuccess(res, 200, 'Applications fetched', {
        candidates: applications.map((app: any) => ({
          id: app.id,
          status: app.status,
          constituencyId: app.constituencyId,
          createdAt: app.createdAt,
          election: app.election,
          party: app.party,
          user: {
            id: app.user.id,
            name: app.user.email.split('@')[0],
            email: app.user.email,
            cnic: app.user.cnic,
            phone: app.user.phone,
            photoUrl: app.user.photoUrl,
            province: app.user.province,
            city: app.user.city,
            fatherName: app.user.fatherName,
            constituencyId: app.user.constituencyId,
          },
          profile: {
            manifesto: app.manifesto,
            experience: app.experience,
            photoUrl: app.portraitPhotoUrl,
            degree: app.degreeName,
            institution: app.institution
          }
        }))
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // PATCH /api/admin/candidates/:id/status
  // Approve or reject a candidate application
  updateCandidateStatus: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status, rejectionReason } = req.body;
      const actorId = (req as any).user.userId;

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return sendError(res, 400, 'Status must be APPROVED or REJECTED');
      }

      const application = await prisma.candidateApplication.findUnique({
        where: { id },
        include: { user: true }
      });
      
      if (!application) return sendError(res, 404, 'Application not found');
      if (application.status !== 'PENDING') {
        return sendError(res, 400, `Application is already ${application.status}`);
      }

      // 1. Update Application status
      const updatedApp = await prisma.candidateApplication.update({
        where: { id },
        data: {
          status,
          adminNotes: rejectionReason || null,
        }
      });

      // 2. If APPROVED, create the official Candidate record
      if (status === 'APPROVED') {
        // Create Candidate
        const candidate = await prisma.candidate.create({
          data: {
            userId: application.userId,
            electionId: application.electionId,
            partyId: application.partyId,
            status: 'APPROVED',
            approvedBy: actorId,
            approvedAt: new Date(),
          }
        });

        // Create Profile
        await prisma.candidateProfile.create({
          data: {
            candidateId: candidate.id,
            manifesto: application.manifesto,
            experience: application.experience,
            photoUrl: application.portraitPhotoUrl,
          }
        });

        // Update User role (optional but recommended)
        await prisma.user.update({
          where: { id: application.userId },
          data: { role: 'CANDIDATE' }
        });
      }

      // 3. Create notification for candidate
      await prisma.notification.create({
        data: {
          userId: application.userId,
          type: status === 'APPROVED' ? 'CANDIDATE_APPROVED' : 'FRAUD_ALERT',
          title: status === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
          message: status === 'APPROVED'
            ? 'Your candidacy application has been approved. You are now an official candidate.'
            : `Your candidacy application has been rejected. Reason: ${rejectionReason || 'See official communication.'}`,
        }
      });

      await auditLog({
        action: `CANDIDATE_${status}`,
        entity: 'CandidateApplication',
        entityId: id,
        actorId,
        metadata: { rejectionReason: rejectionReason || null }
      });

      return sendSuccess(res, 200, `Application ${status.toLowerCase()}`, { application: updatedApp });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/admin/fraud-alerts
  getFraudAlerts: async (req: Request, res: Response) => {
    try {
      const { resolved } = req.query;

      const alerts = await prisma.fraudAlert.findMany({
        where: {
          ...(resolved !== undefined && { isResolved: resolved === 'true' }),
        },
        include: {
          user: { select: { id: true, email: true, cnic: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const counts = await prisma.fraudAlert.groupBy({
        by: ['severity'],
        _count: { severity: true },
        where: { isResolved: false },
      });

      const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      counts.forEach((c: any) => {
        severityCounts[c.severity as keyof typeof severityCounts] = c._count.severity;
      });

      return sendSuccess(res, 200, 'Fraud alerts fetched', { alerts, severityCounts });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // PATCH /api/admin/fraud-alerts/:id/resolve
  resolveFraudAlert: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const actorId = (req as any).user.userId;

      const alert = await prisma.fraudAlert.findUnique({ where: { id } });
      if (!alert) return sendError(res, 404, 'Alert not found');
      if (alert.isResolved) return sendError(res, 400, 'Alert already resolved');

      const updated = await prisma.fraudAlert.update({
        where: { id },
        data: { isResolved: true, resolvedBy: actorId }
      });

      await auditLog({ action: 'FRAUD_ALERT_RESOLVED', entity: 'FraudAlert', entityId: id, actorId });

      return sendSuccess(res, 200, 'Alert resolved', { alert: updated });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  deleteVoter: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const actorId = (req as any).user.userId;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return sendError(res, 404, 'Voter not found');
      }

      // Delete associated vote receipts first due to Restrict onDelete constraint
      await prisma.voteReceipt.deleteMany({
        where: { userId: id }
      });

      // Delete the user record
      await prisma.user.delete({
        where: { id }
      });

      await auditLog({ 
        action: 'VOTER_DELETED', 
        entity: 'User', 
        entityId: id, 
        actorId,
        metadata: { deletedUserEmail: user.email, deletedUserCnic: user.cnic }
      });

      return sendSuccess(res, 200, 'Voter deleted successfully');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },
};

