"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/auth/verify-cnic
router.post('/verify-cnic', auth_controller_1.authController.verifyCnic);
// POST /api/auth/register/init
router.post('/register/init', auth_controller_1.authController.registerInit);
// POST /api/auth/register/profile
router.post('/register/profile', auth_controller_1.authController.updateProfile);
// POST /api/auth/register/complete
router.post('/register/complete', auth_controller_1.authController.completeRegistration);
// POST /api/auth/verify-otp
// Body: { userId, code, type: "PHONE_VERIFY" | "EMAIL_VERIFY" }
// Response: { message: "Verified" }
router.post('/verify-otp', auth_controller_1.authController.verifyOtp);
// POST /api/auth/login
// Body: { email, password }
// Response: { message: "OTP sent", userId }
router.post('/login', auth_controller_1.authController.login);
// POST /api/auth/login/confirm
// Body: { userId, code }
// Response: { accessToken, refreshToken, user: { id, email, role } }
router.post('/login/confirm', auth_controller_1.authController.confirmLogin);
// POST /api/auth/biometric/register
// Body: { biometricToken } — hardware-backed token from device
// Response: { message: "Biometric registered" }
router.post('/biometric/register', auth_middleware_1.authMiddleware, auth_controller_1.authController.registerBiometric);
// POST /api/auth/biometric/login
// Body: { userId, biometricToken }
// Response: { accessToken, refreshToken, user }
router.post('/biometric/login', auth_controller_1.authController.biometricLogin);
// POST /api/auth/refresh
// Body: { refreshToken }
// Response: { accessToken }
router.post('/refresh', auth_controller_1.authController.refreshToken);
// POST /api/auth/forgot-password
// Body: { email }
// Response: { message: "OTP sent" }
router.post('/forgot-password', rateLimit_middleware_1.rateLimitMiddleware.otp, auth_controller_1.authController.forgotPassword);
// POST /api/auth/reset-password
router.post('/reset-password', auth_controller_1.authController.resetPassword);
// POST /api/auth/2fa/verify-backup
router.post('/2fa/verify-backup', auth_controller_1.authController.verifyBackupCode);
// POST /api/auth/2fa/verify-liveness
router.post('/2fa/verify-liveness', auth_controller_1.authController.verifyLiveness);
// POST /api/auth/logout
// Headers: Authorization: Bearer <token>
// Response: { message: "Logged out" }
router.post('/logout', auth_middleware_1.authMiddleware, auth_controller_1.authController.logout);
exports.default = router;
