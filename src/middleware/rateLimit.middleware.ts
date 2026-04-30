import rateLimit from 'express-rate-limit';

const createLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false
  });

export const rateLimitMiddleware = {
  // 500 registration attempts per hour per IP (increased for testing)
  register: createLimiter(60 * 60 * 1000, 500, 'Too many registration attempts. Try again later.'),

  // 10 login attempts per 15 minutes per IP
  login: createLimiter(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.'),

  // 500 OTP requests per 10 minutes per IP (increased for testing)
  otp: createLimiter(10 * 60 * 1000, 500, 'Too many OTP requests. Try again later.'),

  // 1 vote per minute per IP (extra safety on top of DB guard)
  vote: createLimiter(60 * 1000, 1, 'Please wait before casting another vote.')
};
