const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { otpDebug, otpTtlSeconds } = require('../config/env');
const { sendEmailOtp } = require('../services/emailService');
const { sendSmsOtp } = require('../services/smsService');
const { issueOtp, verifyOtpCode } = require('../services/verificationService');
const { signToken } = require('../utils/jwt');

const normalizePhone = (phone) => String(phone || '').replace(/\s+/g, '');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const maskEmail = (email) => {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return '';
  const safeLocal = local.length <= 2 ? `${local[0] || ''}*` : `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}`;
  return `${safeLocal}@${domain}`;
};

const toUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email || '',
  mobileNumber: user.mobileNumber || '',
  avatar: user.avatar,
  bio: user.bio,
  emailVerified: Boolean(user.emailVerifiedAt),
  mobileVerified: Boolean(user.mobileVerifiedAt)
});

const toAuthPayload = (user) => {
  const token = signToken({ sub: String(user._id), email: user.email || '', mobileNumber: user.mobileNumber || '' });
  return {
    token,
    user: toUserPayload(user)
  };
};

const sendEmailVerificationCode = async (user) => {
  const { otp } = await issueOtp({
    target: normalizeEmail(user.email),
    channel: 'email',
    purpose: 'verify-email',
    userId: user._id,
    ttlSeconds: otpTtlSeconds
  });

  const delivery = await sendEmailOtp({
    to: user.email,
    name: user.name,
    otp,
    ttlSeconds: otpTtlSeconds,
    purpose: 'verify-email'
  });

  return { otp, delivery };
};

const register = async (req, res) => {
  const { name, email, password, mobileNumber } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = mobileNumber ? normalizePhone(mobileNumber) : '';

  const existingEmail = await User.findOne({ email: normalizedEmail }).lean();
  if (existingEmail) {
    return res.status(StatusCodes.CONFLICT).json({ message: 'Email already in use' });
  }

  if (normalizedPhone) {
    const existingPhone = await User.findOne({ mobileNumber: normalizedPhone }).lean();
    if (existingPhone) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Mobile number already in use' });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: String(name || '').trim(),
    email: normalizedEmail,
    mobileNumber: normalizedPhone || undefined,
    passwordHash
  });

  const { otp, delivery } = await sendEmailVerificationCode(user);
  const payload = {
    message: 'Account created. Verify your email to continue.',
    requiresEmailVerification: true,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: otpTtlSeconds,
    delivery: delivery.delivered ? 'sent' : delivery.debugOnly ? 'debug' : 'pending_configuration'
  };

  if (otpDebug) {
    payload.otp = otp;
  }

  return res.status(StatusCodes.CREATED).json(payload);
};

const login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const user = await User.findOne({ email, isActive: true }).select('+passwordHash');

  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  if (user.email && !user.emailVerifiedAt) {
    const { otp, delivery } = await sendEmailVerificationCode(user);
    const payload = {
      message: 'Email verification required before login.',
      requiresEmailVerification: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: otpTtlSeconds,
      delivery: delivery.delivered ? 'sent' : delivery.debugOnly ? 'debug' : 'pending_configuration'
    };
    if (otpDebug) {
      payload.otp = otp;
    }
    return res.status(StatusCodes.FORBIDDEN).json(payload);
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

const requestOtp = async (req, res) => {
  const mobileNumber = normalizePhone(req.body.mobileNumber);
  const { otp } = await issueOtp({
    target: mobileNumber,
    channel: 'sms',
    purpose: 'login-mobile',
    ttlSeconds: otpTtlSeconds
  });

  const delivery = await sendSmsOtp({ mobileNumber, otp, ttlSeconds: otpTtlSeconds });
  if (!delivery.delivered && !delivery.debugOnly) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      message: 'Twilio is not configured correctly. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in backend .env.'
    });
  }

  const payload = {
    message: 'OTP sent successfully',
    mobileNumber,
    expiresInSeconds: otpTtlSeconds,
    delivery: delivery.delivered ? 'sent' : 'debug'
  };

  if (otpDebug) {
    payload.otp = otp;
  }

  return res.status(StatusCodes.OK).json(payload);
};

const verifyOtp = async (req, res) => {
  const mobileNumber = normalizePhone(req.body.mobileNumber);
  const { otp } = req.body;
  const providedName = String(req.body.name || '').trim();

  const result = await verifyOtpCode({
    target: mobileNumber,
    channel: 'sms',
    purpose: 'login-mobile',
    otp
  });

  if (!result.ok) {
    const map = {
      not_found: 'OTP expired or not found',
      expired: 'OTP expired or not found',
      invalid: 'Invalid OTP',
      too_many_attempts: 'Too many invalid attempts. Request a new OTP.'
    };
    const status = result.reason === 'too_many_attempts' ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED;
    return res.status(status).json({ message: map[result.reason] || 'OTP verification failed' });
  }

  let user = await User.findOne({ mobileNumber, isActive: true });

  if (!user) {
    const safeDigits = mobileNumber.replace(/\D/g, '');
    const name = providedName || `User ${safeDigits.slice(-4) || 'New'}`;
    const pseudoEmail = `mobile_${safeDigits || crypto.randomUUID()}@baatein.local`;
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

    user = await User.create({
      name,
      email: pseudoEmail,
      mobileNumber,
      passwordHash,
      mobileVerifiedAt: new Date()
    });
  } else if (!user.mobileVerifiedAt) {
    user.mobileVerifiedAt = new Date();
    await user.save();
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

const requestEmailVerification = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email, isActive: true });

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Account not found for that email' });
  }

  if (user.emailVerifiedAt) {
    return res.status(StatusCodes.OK).json({
      message: 'Email is already verified',
      email: user.email,
      maskedEmail: maskEmail(user.email)
    });
  }

  const { otp, delivery } = await sendEmailVerificationCode(user);
  const payload = {
    message: 'Verification code sent to email',
    email: user.email,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: otpTtlSeconds,
    delivery: delivery.delivered ? 'sent' : delivery.debugOnly ? 'debug' : 'pending_configuration'
  };

  if (otpDebug) {
    payload.otp = otp;
  }

  return res.status(StatusCodes.OK).json(payload);
};

const verifyEmail = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { otp } = req.body;

  const user = await User.findOne({ email, isActive: true }).select('+passwordHash');
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: 'Account not found for that email' });
  }

  const result = await verifyOtpCode({
    target: email,
    channel: 'email',
    purpose: 'verify-email',
    otp
  });

  if (!result.ok) {
    const map = {
      not_found: 'Verification code expired or not found',
      expired: 'Verification code expired or not found',
      invalid: 'Invalid verification code',
      too_many_attempts: 'Too many invalid attempts. Request a new code.'
    };
    const status = result.reason === 'too_many_attempts' ? StatusCodes.TOO_MANY_REQUESTS : StatusCodes.UNAUTHORIZED;
    return res.status(status).json({ message: map[result.reason] || 'Email verification failed' });
  }

  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

module.exports = {
  register,
  login,
  requestOtp,
  verifyOtp,
  requestEmailVerification,
  verifyEmail
};

