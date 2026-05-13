import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendError, sendSuccess } from '../utils/response';

const getDisplayName = (user: { email: string; fatherName?: string | null }) =>
  user.fatherName?.trim() || user.email.split('@')[0];

const mapCandidateSummary = (
  candidate: any,
  canShowResults = false
) => ({
  id: candidate.id,
  electionId: candidate.electionId,
  displayName: getDisplayName(candidate.user),
  partyLabel: candidate.profile?.experience?.trim() || 'Independent',
  photoUrl: candidate.profile?.photoUrl || candidate.user.photoUrl || null,
  manifestoSummary: candidate.profile?.manifesto || null,
  profileViews: candidate.profile?.profileViews || 0,
  voteCount: canShowResults ? candidate.voteCount?.count ?? 0 : null,
  votePercentage: canShowResults && candidate.votePercentage != null ? candidate.votePercentage : null,
  rank: canShowResults && candidate.rank != null ? candidate.rank : null,
});

export const candidateController = {
  getAll: async (_req: Request, res: Response) => {
    try {
      const candidates = await prisma.candidate.findMany({
        where: { status: 'APPROVED' },
        include: {
          user: { select: { email: true, fatherName: true, photoUrl: true } },
          profile: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(res, 200, 'Candidates fetched', {
        candidates: candidates.map((candidate) => mapCandidateSummary(candidate)),
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: String(req.params.id) },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fatherName: true,
              photoUrl: true,
              province: true,
              city: true,
            },
          },
          profile: true,
          voteCount: true,
          election: {
            include: {
              constituency: true,
            },
          },
        },
      });

      if (!candidate) {
        return sendError(res, 404, 'Candidate not found');
      }

      const canShowResults = candidate.election.status === 'RESULTS_PUBLISHED';

      return sendSuccess(res, 200, 'Candidate fetched', {
        candidate: {
          ...mapCandidateSummary(candidate, canShowResults),
          candidateUserId: candidate.user.id,
          status: candidate.status,
          experience: candidate.profile?.experience || null,
          videoUrl: candidate.profile?.videoUrl || null,
          manifesto: candidate.profile?.manifesto || null,
          promises: candidate.profile?.promises || [],
          constituency: candidate.election.constituency
            ? {
                id: candidate.election.constituency.id,
                name: candidate.election.constituency.name,
                code: candidate.election.constituency.code,
                type: candidate.election.constituency.type,
              }
            : null,
          election: {
            id: candidate.election.id,
            title: candidate.election.title,
            status: candidate.election.status,
            startDate: candidate.election.startDate,
            endDate: candidate.election.endDate,
          },
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  compare: async (req: Request, res: Response) => {
    try {
      const rawIds = req.query.ids;
      const ids = Array.isArray(rawIds) ? rawIds.map(String) : typeof rawIds === 'string' ? [rawIds] : [];

      if (ids.length !== 2) {
        return sendError(res, 400, 'Exactly two candidate ids are required');
      }

      const candidates = await prisma.candidate.findMany({
        where: { id: { in: ids } },
        include: {
          user: { select: { id: true, email: true, fatherName: true, photoUrl: true } },
          profile: true,
          voteCount: true,
          election: { include: { constituency: true } },
        },
      });

      if (candidates.length !== 2) {
        return sendError(res, 404, 'One or more candidates were not found');
      }

      const [first] = candidates;
      const sameElection = candidates.every((candidate) => candidate.electionId === first.electionId);
      if (!sameElection) {
        return sendError(res, 400, 'Candidates must belong to the same election');
      }

      const canShowResults = first.election.status === 'RESULTS_PUBLISHED';

      return sendSuccess(res, 200, 'Candidate comparison fetched', {
        comparison: {
          electionId: first.election.id,
          electionTitle: first.election.title,
          candidates: candidates.map((candidate) => ({
            ...mapCandidateSummary(candidate, canShowResults),
            candidateUserId: candidate.user.id,
            status: candidate.status,
            experience: candidate.profile?.experience || null,
            videoUrl: candidate.profile?.videoUrl || null,
            manifesto: candidate.profile?.manifesto || null,
            promises: candidate.profile?.promises || [],
            constituency: candidate.election.constituency
              ? {
                  id: candidate.election.constituency.id,
                  name: candidate.election.constituency.name,
                  code: candidate.election.constituency.code,
                  type: candidate.election.constituency.type,
                }
              : null,
            election: {
              id: candidate.election.id,
              title: candidate.election.title,
              status: candidate.election.status,
              startDate: candidate.election.startDate,
              endDate: candidate.election.endDate,
            },
          })),
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },
};
