import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/verify-cnic
router.post('/verify-cnic', authController.verifyCnic);

// POST /api/auth/register/init
router.post('/register/init', authController.registerInit);

// POST /api/auth/register/profile
router.post('/register/profile', authController.updateProfile);

// POST /api/auth/register/complete
router.post('/register/complete', authController.completeRegistration);

// POST /api/auth/verify-otp
// Body: { userId, code, type: "PHONE_VERIFY" | "EMAIL_VERIFY" }
// Response: { message: "Verified" }
router.post('/verify-otp', authController.verifyOtp);

// POST /api/auth/login
// Body: { email, password }
// Response: { message: "OTP sent", userId }
router.post('/login', authController.login);

// POST /api/auth/login/confirm
// Body: { userId, code }
// Response: { accessToken, refreshToken, user: { id, email, role } }
router.post('/login/confirm', authController.confirmLogin);

// POST /api/auth/biometric/register
// Body: { biometricToken } — hardware-backed token from device
// Response: { message: "Biometric registered" }
router.post('/biometric/register', authMiddleware, authController.registerBiometric);

// POST /api/auth/biometric/login
// Body: { userId, biometricToken }
// Response: { accessToken, refreshToken, user }
router.post('/biometric/login', authController.biometricLogin);

// POST /api/auth/refresh
// Body: { refreshToken }
// Response: { accessToken }
router.post('/refresh', authController.refreshToken);

// POST /api/auth/forgot-password
// Body: { email }
// Response: { message: "OTP sent" }
router.post('/forgot-password', rateLimitMiddleware.otp, authController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', authController.resetPassword);

// POST /api/auth/2fa/verify-backup
router.post('/2fa/verify-backup', authController.verifyBackupCode);

// POST /api/auth/2fa/verify-liveness
router.post('/2fa/verify-liveness', authController.verifyLiveness);

// POST /api/auth/logout
// Headers: Authorization: Bearer <token>
// Response: { message: "Logged out" }
router.post('/logout', authMiddleware, authController.logout);

export default router;
