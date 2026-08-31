import rateLimit from 'express-rate-limit';

/**
 * Auth / OTP / password-reset throttle.
 * Returns JSON 429 (not HTML) so SPA clients can show a clear message.
 */
function buildAuthLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
    statusCode: 429,
  });
}

/** Login attempts: 20 / 15 minutes per IP */
export const loginRateLimiter = buildAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

/** Forgot-password / OTP send: 5 / 15 minutes per IP */
export const forgotPasswordRateLimiter = buildAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

/** OTP verify: 10 / 15 minutes per IP */
export const otpVerifyRateLimiter = buildAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many OTP verification attempts. Please try again in 15 minutes.',
});

/** Password reset submit: 10 / 15 minutes per IP */
export const resetPasswordRateLimiter = buildAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
});

/** Public survey / panelist signup style traffic: 120 / 15 minutes per IP */
export const publicApiRateLimiter = buildAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: 'Too many requests. Please try again later.',
});
