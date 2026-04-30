import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App password
  },
});

export const otpService = {
  // Create an OTP for a user
  createOtp: async (userId: string, type: 'EMAIL_VERIFY' | 'PHONE_VERIFY' | 'LOGIN' | 'PASSWORD_RESET') => {
    // Generate a 6-digit code for registration/login, 4-digit for password reset
    const code = type === 'PASSWORD_RESET' 
        ? Math.floor(1000 + Math.random() * 9000).toString() 
        : Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Mark old codes for this user and type as used
    await prisma.otpCode.updateMany({
      where: { userId, type, isUsed: false },
      data: { isUsed: true }
    });

    return await prisma.otpCode.create({
      data: {
        userId,
        code,
        type,
        expiresAt,
        isUsed: false
      }
    });
  },

  // Generate and "send" OTP
  send: async (userId: string, identifier: string, type: 'EMAIL_VERIFY' | 'PHONE_VERIFY' | 'LOGIN' | 'PASSWORD_RESET') => {
    const otp = await otpService.createOtp(userId, type);
    
    console.log(`[OTP DEBUG] Sending ${otp.code} to ${identifier} (${type})`);
    
    // If it's an email related action, send via Gmail
    if (type === 'EMAIL_VERIFY' || type === 'PASSWORD_RESET' || type === 'LOGIN') {
      try {
        await transporter.sendMail({
          from: `"iBallot Security" <${process.env.SMTP_USER}>`,
          to: identifier, // 'identifier' is the email address in this context
          subject: 'Your iBallot Verification Code',
          text: `Your verification code is: ${otp.code}\n\nThis code will expire in 10 minutes.`,
          html: `<p>Your verification code is: <strong>${otp.code}</strong></p><p>This code will expire in 10 minutes.</p>`,
        });
        console.log(`[OTP DEBUG] Email sent to ${identifier}`);
      } catch (error) {
        console.error(`[OTP DEBUG] Failed to send email to ${identifier}:`, error);
      }
    }
    
    return otp;
  },

  // Verify an OTP
  verifyOtp: async (userId: string, code: string, type: any) => {
    const otp = await prisma.otpCode.findFirst({
      where: {
        userId,
        code,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otp) return false;

    // Mark as used
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { isUsed: true }
    });

    return true;
  }
};
