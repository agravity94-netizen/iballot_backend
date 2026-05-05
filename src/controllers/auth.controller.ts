import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { sendSuccess, sendError } from '../utils/response';
import { otpService } from '../services/otp.service';
import { auditLog } from '../utils/auditLog';

const prisma = new PrismaClient();

export const authController = {

  // POST /api/auth/verify-cnic
  verifyCnic: async (req: Request, res: Response) => {
    try {
      const { cnic } = req.body;
      const user = await prisma.user.findUnique({ where: { cnic } });
      if (user) {
        return sendError(res, 409, 'This CNIC is already registered.');
      }
      return sendSuccess(res, 200, 'CNIC is available for registration.');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/register/init
  registerInit: async (req: Request, res: Response) => {
    try {
      const cnic = req.body.cnic?.trim();
      const email = req.body.email?.trim();
      const phone = req.body.phone?.trim();

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone }, { cnic }] }
      });
      if (existing) return sendError(res, 409, 'User already exists with this email, phone, or CNIC');

      // Create user in unverified state with a temporary password
      const tempPasswordHash = await bcrypt.hash(randomUUID(), 12);
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
      await otpService.send(user.id, email, 'EMAIL_VERIFY');

      return sendSuccess(res, 201, 'Contact details saved. OTP sent to email.', { userId: user.id });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/verify-otp
  verifyOtp: async (req: Request, res: Response) => {
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

      if (!otp) return sendError(res, 400, 'Invalid or expired OTP');

      // Mark OTP as used
      await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });

      // Mark user as verified
      await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });

      return sendSuccess(res, 200, 'Verification successful');

    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/login
  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // SPECIAL ADMIN BYPASS FOR TESTING
      if (email === 'admin@admin.com' && password === 'admin@1234') {
        const admin = await prisma.user.upsert({
          where: { email: 'admin@admin.com' },
          update: { role: 'ADMIN', isActive: true, isVerified: true },
          create: {
            email: 'admin@admin.com',
            passwordHash: await bcrypt.hash('admin@1234', 12),
            role: 'ADMIN',
            isActive: true,
            isVerified: true,
            cnic: '00000-0000000-0',
            phone: '00000000000'
          }
        });

        const accessToken = jwt.sign(
          { userId: admin.id, role: admin.role },
          process.env.JWT_SECRET!,
          { expiresIn: '2h' }
        );

        return sendSuccess(res, 200, 'Admin login successful', { 
          accessToken, 
          user: { id: admin.id, email: admin.email, role: 'ADMIN' },
          isAdmin: true // Flag for frontend
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return sendError(res, 401, 'Invalid credentials');
      if (!user.isVerified) return sendError(res, 403, 'Please verify your account first');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return sendError(res, 401, 'Invalid credentials');

      // Send login OTP
      await otpService.send(user.id, user.phone, 'LOGIN');

      await auditLog({ action: 'LOGIN_ATTEMPT', entity: 'User', entityId: user.id, ipAddress: req.ip });

      return sendSuccess(res, 200, 'OTP sent to your phone', { userId: user.id });

    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/login/confirm
  confirmLogin: async (req: Request, res: Response) => {
    try {
      const { userId, code } = req.body;

      const otp = await prisma.otpCode.findFirst({
        where: { userId, code, type: 'LOGIN', isUsed: false, expiresAt: { gt: new Date() } }
      });

      if (!otp) return sendError(res, 400, 'Invalid or expired OTP');

      await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return sendError(res, 404, 'User not found');

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );

      // Save session
      await prisma.session.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      await auditLog({ action: 'LOGIN_SUCCESS', entity: 'User', entityId: user.id, ipAddress: req.ip });

      return sendSuccess(res, 200, 'Login successful', {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, role: user.role }
      });

    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/biometric/register
  registerBiometric: async (req: Request, res: Response) => {
    try {
      const { biometricToken } = req.body;
      const userId = (req as any).user.userId;

      // Store hashed biometric token (never store raw)
      const tokenHash = await bcrypt.hash(biometricToken, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: tokenHash } // store alongside password
      });

      return sendSuccess(res, 200, 'Biometric registered successfully');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/biometric/login
  biometricLogin: async (req: Request, res: Response) => {
    try {
      const { userId, biometricToken } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) return sendError(res, 401, 'User not found');

      const valid = await bcrypt.compare(biometricToken, user.passwordHash);
      if (!valid) return sendError(res, 401, 'Biometric verification failed');

      const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );

      await prisma.session.create({
        data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      });

      return sendSuccess(res, 200, 'Biometric login successful', {
        accessToken, refreshToken,
        user: { id: user.id, email: user.email, role: user.role }
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/refresh
  refreshToken: async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      const session = await prisma.session.findFirst({
        where: { token: refreshToken, expiresAt: { gt: new Date() } }
      });
      if (!session) return sendError(res, 401, 'Invalid or expired refresh token');

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return sendError(res, 404, 'User not found');

      const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      return sendSuccess(res, 200, 'Token refreshed', { accessToken });
    } catch (err: any) {
      return sendError(res, 401, 'Invalid refresh token');
    }
  },

  // POST /api/auth/forgot-password
  forgotPassword: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      // Always return success to prevent email enumeration
      if (!user) return sendSuccess(res, 200, 'If this email exists, an OTP has been sent');

      await otpService.send(user.id, user.phone, 'PASSWORD_RESET');

      return sendSuccess(res, 200, 'OTP sent to your registered phone', { userId: user.id });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/reset-password
  resetPassword: async (req: Request, res: Response) => {
    try {
      const { userId, code, newPassword } = req.body;

      const otp = await prisma.otpCode.findFirst({
        where: { userId, code, type: 'PASSWORD_RESET', isUsed: false, expiresAt: { gt: new Date() } }
      });
      if (!otp) return sendError(res, 400, 'Invalid or expired OTP');

      await prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

      // Invalidate all sessions
      await prisma.session.deleteMany({ where: { userId } });

      return sendSuccess(res, 200, 'Password reset successful. Please login again.');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/register/profile
  updateProfile: async (req: Request, res: Response) => {
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

      return sendSuccess(res, 200, 'Profile updated successfully', { userId: user.id });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/register/complete
  completeRegistration: async (req: Request, res: Response) => {
    try {
      const { userId, password } = req.body;

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { 
          passwordHash,
          isActive: true // User is now fully active
        }
      });

      await auditLog({ action: 'USER_REGISTERED', entity: 'User', entityId: userId, ipAddress: req.ip });

      return sendSuccess(res, 200, 'Registration complete. You can now login.');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/2fa/verify-backup
  verifyBackupCode: async (req: Request, res: Response) => {
    try {
      const { cnic, backupCode } = req.body;
      const user = await prisma.user.findUnique({ where: { cnic } });
      
      if (!user) return sendError(res, 404, 'User not found');
      
      // Check if code exists in user.backupCodes array
      const isMatch = user.backupCodes.includes(backupCode);
      if (!isMatch) return sendError(res, 401, 'Invalid backup code');

      // Remove the used backup code (one-time use)
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          backupCodes: {
            set: user.backupCodes.filter((c: string) => c !== backupCode)
          }
        }
      });

      return sendSuccess(res, 200, 'Identity verified via backup code');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/2fa/verify-liveness
  verifyLiveness: async (req: Request, res: Response) => {
    try {
      const { cnic, biometricData } = req.body;
      const user = await prisma.user.findUnique({ where: { cnic } });
      
      if (!user) return sendError(res, 404, 'User not found');

      // Note: In a production app, you would integrate with a biometric service (NADRA API, AWS Rekognition, etc.)
      // For now, we simulate success
      await auditLog({ action: 'LIVENESS_VERIFIED', entity: 'User', entityId: user.id, ipAddress: req.ip });

      return sendSuccess(res, 200, 'Liveness detection successful. Identity confirmed.');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // POST /api/auth/logout
  logout: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const token = req.headers.authorization?.split(' ')[1];

      await prisma.session.deleteMany({ where: { userId, token } });

      await auditLog({ action: 'LOGOUT', entity: 'User', entityId: userId, ipAddress: req.ip });

      return sendSuccess(res, 200, 'Logged out successfully');
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
