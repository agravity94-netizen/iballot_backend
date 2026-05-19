import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendError, sendSuccess } from '../utils/response';

const getRegistrationStatus = (user: any) => {
  if (!user.isVerified || !user.isActive) return 'PENDING';
  if (!user.constituencyId) return 'INCOMPLETE';
  return 'ACTIVE';
};

export const userController = {
  getMe: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { constituency: true },
      });

      if (!user) {
        return sendError(res, 404, 'User not found');
      }

      return sendSuccess(res, 200, 'Profile fetched', {
        profile: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          cnic: user.cnic,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          photoUrl: user.photoUrl,
          fatherName: user.fatherName,
          province: user.province,
          city: user.city,
          addressDetails: user.addressDetails,
          biometricEnabled: Boolean(user.biometricTokenHash),
          registrationStatus: getRegistrationStatus(user),
          constituency: user.constituency
            ? {
                id: user.constituency.id,
                name: user.constituency.name,
                code: user.constituency.code,
                type: user.constituency.type,
              }
            : null,
          eligibility: {
            isVerified: user.isVerified,
            isActive: user.isActive,
            hasConstituency: Boolean(user.constituencyId),
            canVote: user.role === 'VOTER' && user.isVerified && user.isActive && Boolean(user.constituencyId),
          },
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  updateMe: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const allowedFields = ['phone', 'photoUrl', 'fatherName', 'province', 'city', 'addressDetails', 'constituencyId'] as const;
      const data = allowedFields.reduce<Record<string, unknown>>((acc, field) => {
        if (req.body[field] !== undefined) {
          acc[field] = req.body[field];
        }
        return acc;
      }, {});

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        include: { constituency: true },
      });

      return sendSuccess(res, 200, 'Profile updated', {
        profile: {
          id: updatedUser.id,
          email: updatedUser.email,
          phone: updatedUser.phone,
          cnic: updatedUser.cnic,
          role: updatedUser.role,
          isVerified: updatedUser.isVerified,
          isActive: updatedUser.isActive,
          photoUrl: updatedUser.photoUrl,
          fatherName: updatedUser.fatherName,
          province: updatedUser.province,
          city: updatedUser.city,
          addressDetails: updatedUser.addressDetails,
          biometricEnabled: Boolean(updatedUser.biometricTokenHash),
          registrationStatus: getRegistrationStatus(updatedUser),
          constituency: updatedUser.constituency
            ? {
                id: updatedUser.constituency.id,
                name: updatedUser.constituency.name,
                code: updatedUser.constituency.code,
                type: updatedUser.constituency.type,
              }
            : null,
          eligibility: {
            isVerified: updatedUser.isVerified,
            isActive: updatedUser.isActive,
            hasConstituency: Boolean(updatedUser.constituencyId),
            canVote:
              updatedUser.role === 'VOTER' &&
              updatedUser.isVerified &&
              updatedUser.isActive &&
              Boolean(updatedUser.constituencyId),
          },
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },
};
