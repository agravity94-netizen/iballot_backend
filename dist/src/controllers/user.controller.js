"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const getRegistrationStatus = (user) => {
    if (!user.isVerified || !user.isActive)
        return 'PENDING';
    if (!user.constituencyId)
        return 'INCOMPLETE';
    return 'ACTIVE';
};
exports.userController = {
    getMe: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await database_1.default.user.findUnique({
                where: { id: userId },
                include: { constituency: true },
            });
            if (!user) {
                return (0, response_1.sendError)(res, 404, 'User not found');
            }
            return (0, response_1.sendSuccess)(res, 200, 'Profile fetched', {
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
                    twoFactorEnabled: user.twoFactorEnabled,
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
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    updateMe: async (req, res) => {
        try {
            const userId = req.user.userId;
            const allowedFields = ['phone', 'photoUrl', 'fatherName', 'province', 'city', 'addressDetails', 'constituencyId', 'twoFactorEnabled'];
            const data = allowedFields.reduce((acc, field) => {
                if (req.body[field] !== undefined) {
                    acc[field] = req.body[field];
                }
                return acc;
            }, {});
            const updatedUser = await database_1.default.user.update({
                where: { id: userId },
                data,
                include: { constituency: true },
            });
            await (0, auditLog_1.auditLog)({
                action: 'PROFILE_UPDATED',
                entity: 'User',
                entityId: userId,
                actorId: userId,
                ipAddress: req.ip,
                metadata: {
                    updatedFields: Object.keys(data)
                }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Profile updated', {
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
                    twoFactorEnabled: updatedUser.twoFactorEnabled,
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
                        canVote: updatedUser.role === 'VOTER' &&
                            updatedUser.isVerified &&
                            updatedUser.isActive &&
                            Boolean(updatedUser.constituencyId),
                    },
                },
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    getActivities: async (req, res) => {
        try {
            const userId = req.user.userId;
            const logs = await database_1.default.auditLog.findMany({
                where: {
                    OR: [
                        { actorId: userId },
                        { entityId: userId, entity: 'User' }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            return (0, response_1.sendSuccess)(res, 200, 'Activity logs fetched', { logs });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
};
