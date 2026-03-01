const express = require('express');
const validate = require('../middleware/validate');
const { register, login, requestOtp, verifyOtp } = require('../controllers/authController');
const { registerSchema, loginSchema, requestOtpSchema, verifyOtpSchema } = require('../utils/validators');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/request-otp', validate(requestOtpSchema), requestOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);

module.exports = router;