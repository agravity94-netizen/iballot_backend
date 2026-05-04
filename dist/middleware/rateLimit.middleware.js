"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const createLimiter = (windowMs, max, message) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false
});
exports.rateLimitMiddleware = {
    // 500 registration attempts per hour per IP (increased for testing)
    register: createLimiter(60 * 60 * 1000, 500, 'Too many registration attempts. Try again later.'),
    // 10 login attempts per 15 minutes per IP
    login: createLimiter(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.'),
    // 500 OTP requests per 10 minutes per IP (increased for testing)
    otp: createLimiter(10 * 60 * 1000, 500, 'Too many OTP requests. Try again later.'),
    // 1 vote per minute per IP (extra safety on top of DB guard)
    vote: createLimiter(60 * 1000, 1, 'Please wait before casting another vote.')
};
