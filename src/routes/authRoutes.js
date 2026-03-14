const express = require('express');
const validate = require('../middleware/validate');
const {
  register,
  login,
  requestOtp,
  verifyOtp,
  requestEmailVerification,
  verifyEmail
} = require('../controllers/authController');
const {
  registerSchema,
  loginSchema,
  requestOtpSchema,
  verifyOtpSchema,
  requestEmailVerificationSchema,
  verifyEmailSchema
} = require('../utils/validators');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/request-otp', validate(requestOtpSchema), requestOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/request-email-verification', validate(requestEmailVerificationSchema), requestEmailVerification);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

module.exports = router;
