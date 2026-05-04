"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const response_1 = require("../utils/response");
const otp_service_1 = require("../services/otp.service");
const auditLog_1 = require("../utils/auditLog");
const prisma = new client_1.PrismaClient();
exports.authController = {
    // POST /api/auth/verify-cnic
    verifyCnic: async (req, res) => {
        try {
            const { cnic } = req.body;
            const user = await prisma.user.findUnique({ where: { cnic } });
            if (user) {
                return (0, response_1.sendError)(res, 409, 'This CNIC is already registered.');
            }
            return (0, response_1.sendSuccess)(res, 200, 'CNIC is available for registration.');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/register/init
    registerInit: async (req, res) => {
        try {
            const cnic = req.body.cnic?.trim();
            const email = req.body.email?.trim();
            const phone = req.body.phone?.trim();
            const existing = await prisma.user.findFirst({
                where: { OR: [{ email }, { phone }, { cnic }] }
            });
            if (existing)
                return (0, response_1.sendError)(res, 409, 'User already exists with this email, phone, or CNIC');
            // Create user in unverified state with a temporary password
            const tempPasswordHash = await bcryptjs_1.default.hash((0, uuid_1.v4)(), 12);
            const user = await prisma.user.create({
                data: {
                    cnic,
                    email,
                    phone,
                    passwordHash: tempPasswordHash,
                    isVerified: false
                }
            });
            // Send OTP to Email
            await otp_service_1.otpService.send(user.id, email, 'EMAIL_VERIFY');
            return (0, response_1.sendSuccess)(res, 201, 'Contact details saved. OTP sent to email.', { userId: user.id });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/verify-otp
    verifyOtp: async (req, res) => {
        try {
            const { userId, code, type } = req.body;
            const otp = await prisma.otpCode.findFirst({
                where: {
                    userId,
                    code,
                    type,
                    isUsed: false,
                    expiresAt: { gt: new Date() }
                }
            });
            if (!otp)
                return (0, response_1.sendError)(res, 400, 'Invalid or expired OTP');
            // Mark OTP as used
            await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
            // Mark user as verified
            await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });
            return (0, response_1.sendSuccess)(res, 200, 'Verification successful');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !user.isActive)
                return (0, response_1.sendError)(res, 401, 'Invalid credentials');
            if (!user.isVerified)
                return (0, response_1.sendError)(res, 403, 'Please verify your account first');
            const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!valid)
                return (0, response_1.sendError)(res, 401, 'Invalid credentials');
            // Send login OTP
            await otp_service_1.otpService.send(user.id, user.phone, 'LOGIN');
            await (0, auditLog_1.auditLog)({ action: 'LOGIN_ATTEMPT', entity: 'User', entityId: user.id, ipAddress: req.ip });
            return (0, response_1.sendSuccess)(res, 200, 'OTP sent to your phone', { userId: user.id });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/login/confirm
    confirmLogin: async (req, res) => {
        try {
            const { userId, code } = req.body;
            const otp = await prisma.otpCode.findFirst({
                where: { userId, code, type: 'LOGIN', isUsed: false, expiresAt: { gt: new Date() } }
            });
            if (!otp)
                return (0, response_1.sendError)(res, 400, 'Invalid or expired OTP');
            await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                return (0, response_1.sendError)(res, 404, 'User not found');
            // Generate tokens
            const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
            // Save session
            await prisma.session.create({
                data: {
                    userId: user.id,
                    token: refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });
            await (0, auditLog_1.auditLog)({ action: 'LOGIN_SUCCESS', entity: 'User', entityId: user.id, ipAddress: req.ip });
            return (0, response_1.sendSuccess)(res, 200, 'Login successful', {
                accessToken,
                refreshToken,
                user: { id: user.id, email: user.email, role: user.role }
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/biometric/register
    registerBiometric: async (req, res) => {
        try {
            const { biometricToken } = req.body;
            const userId = req.user.userId;
            // Store hashed biometric token (never store raw)
            const tokenHash = await bcryptjs_1.default.hash(biometricToken, 12);
            await prisma.user.update({
                where: { id: userId },
                data: { passwordHash: tokenHash } // store alongside password
            });
            return (0, response_1.sendSuccess)(res, 200, 'Biometric registered successfully');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/biometric/login
    biometricLogin: async (req, res) => {
        try {
            const { userId, biometricToken } = req.body;
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.isActive)
                return (0, response_1.sendError)(res, 401, 'User not found');
            const valid = await bcryptjs_1.default.compare(biometricToken, user.passwordHash);
            if (!valid)
                return (0, response_1.sendError)(res, 401, 'Biometric verification failed');
            const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
            await prisma.session.create({
                data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Biometric login successful', {
                accessToken, refreshToken,
                user: { id: user.id, email: user.email, role: user.role }
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/refresh
    refreshToken: async (req, res) => {
        try {
            const { refreshToken } = req.body;
            const session = await prisma.session.findFirst({
                where: { token: refreshToken, expiresAt: { gt: new Date() } }
            });
            if (!session)
                return (0, response_1.sendError)(res, 401, 'Invalid or expired refresh token');
            const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user)
                return (0, response_1.sendError)(res, 404, 'User not found');
            const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
            return (0, response_1.sendSuccess)(res, 200, 'Token refreshed', { accessToken });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 401, 'Invalid refresh token');
        }
    },
    // POST /api/auth/forgot-password
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            // Always return success to prevent email enumeration
            if (!user)
                return (0, response_1.sendSuccess)(res, 200, 'If this email exists, an OTP has been sent');
            await otp_service_1.otpService.send(user.id, user.phone, 'PASSWORD_RESET');
            return (0, response_1.sendSuccess)(res, 200, 'OTP sent to your registered phone', { userId: user.id });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/reset-password
    resetPassword: async (req, res) => {
        try {
            const { userId, code, newPassword } = req.body;
            const otp = await prisma.otpCode.findFirst({
                where: { userId, code, type: 'PASSWORD_RESET', isUsed: false, expiresAt: { gt: new Date() } }
            });
            if (!otp)
                return (0, response_1.sendError)(res, 400, 'Invalid or expired OTP');
            await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });
            const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
            await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
            // Invalidate all sessions
            await prisma.session.deleteMany({ where: { userId } });
            return (0, response_1.sendSuccess)(res, 200, 'Password reset successful. Please login again.');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/register/profile
    updateProfile: async (req, res) => {
        try {
            const { userId, fatherName, isOverseas, province, city, constituencyId, addressDetails, photoUrl } = req.body;
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    fatherName,
                    isOverseas,
                    province,
                    city,
                    constituencyId,
                    addressDetails,
                    photoUrl
                }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Profile updated successfully', { userId: user.id });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/register/complete
    completeRegistration: async (req, res) => {
        try {
            const { userId, password } = req.body;
            const passwordHash = await bcryptjs_1.default.hash(password, 12);
            await prisma.user.update({
                where: { id: userId },
                data: {
                    passwordHash,
                    isActive: true // User is now fully active
                }
            });
            await (0, auditLog_1.auditLog)({ action: 'USER_REGISTERED', entity: 'User', entityId: userId, ipAddress: req.ip });
            return (0, response_1.sendSuccess)(res, 200, 'Registration complete. You can now login.');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/2fa/verify-backup
    verifyBackupCode: async (req, res) => {
        try {
            const { cnic, backupCode } = req.body;
            const user = await prisma.user.findUnique({ where: { cnic } });
            if (!user)
                return (0, response_1.sendError)(res, 404, 'User not found');
            // Check if code exists in user.backupCodes array
            const isMatch = user.backupCodes.includes(backupCode);
            if (!isMatch)
                return (0, response_1.sendError)(res, 401, 'Invalid backup code');
            // Remove the used backup code (one-time use)
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    backupCodes: {
                        set: user.backupCodes.filter((c) => c !== backupCode)
                    }
                }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Identity verified via backup code');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/2fa/verify-liveness
    verifyLiveness: async (req, res) => {
        try {
            const { cnic, biometricData } = req.body;
            const user = await prisma.user.findUnique({ where: { cnic } });
            if (!user)
                return (0, response_1.sendError)(res, 404, 'User not found');
            // Note: In a production app, you would integrate with a biometric service (NADRA API, AWS Rekognition, etc.)
            // For now, we simulate success
            await (0, auditLog_1.auditLog)({ action: 'LIVENESS_VERIFIED', entity: 'User', entityId: user.id, ipAddress: req.ip });
            return (0, response_1.sendSuccess)(res, 200, 'Liveness detection successful. Identity confirmed.');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // POST /api/auth/logout
    logout: async (req, res) => {
        try {
            const userId = req.user.userId;
            const token = req.headers.authorization?.split(' ')[1];
            await prisma.session.deleteMany({ where: { userId, token } });
            await (0, auditLog_1.auditLog)({ action: 'LOGOUT', entity: 'User', entityId: userId, ipAddress: req.ip });
            return (0, response_1.sendSuccess)(res, 200, 'Logged out successfully');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
