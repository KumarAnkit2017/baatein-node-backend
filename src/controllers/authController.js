const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const OtpCode = require('../models/OtpCode');
const { signToken } = require('../utils/jwt');
const { otpTtlSeconds, otpDebug } = require('../config/env');

const normalizePhone = (phone) => String(phone || '').replace(/\s+/g, '');

const toAuthPayload = (user) => {
  const token = signToken({ sub: String(user._id), email: user.email || '', mobileNumber: user.mobileNumber || '' });
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email || '',
      mobileNumber: user.mobileNumber || '',
      avatar: user.avatar,
      bio: user.bio
    }
  };
};

const register = async (req, res) => {
  const { name, email, password, mobileNumber } = req.body;

  const existingEmail = await User.findOne({ email }).lean();
  if (existingEmail) {
    return res.status(StatusCodes.CONFLICT).json({ message: 'Email already in use' });
  }

  const phone = mobileNumber ? normalizePhone(mobileNumber) : null;
  if (phone) {
    const existingPhone = await User.findOne({ mobileNumber: phone }).lean();
    if (existingPhone) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Mobile number already in use' });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, mobileNumber: phone, passwordHash });

  return res.status(StatusCodes.CREATED).json(toAuthPayload(user));
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, isActive: true }).select('+passwordHash');

  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

const requestOtp = async (req, res) => {
  const mobileNumber = normalizePhone(req.body.mobileNumber);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 10);

  await OtpCode.deleteMany({
    $or: [
      { mobileNumber },
      { expiresAt: { $lt: new Date() } }
    ]
  });

  await OtpCode.create({
    mobileNumber,
    otpHash,
    expiresAt: new Date(Date.now() + otpTtlSeconds * 1000)
  });

  const payload = {
    message: 'OTP sent successfully',
    mobileNumber,
    expiresInSeconds: otpTtlSeconds
  };

  if (otpDebug) {
    payload.otp = otp;
  }

  return res.status(StatusCodes.OK).json(payload);
};

const verifyOtp = async (req, res) => {
  const mobileNumber = normalizePhone(req.body.mobileNumber);
  const { otp } = req.body;
  const providedName = (req.body.name || '').trim();

  const record = await OtpCode.findOne({ mobileNumber }).sort({ createdAt: -1 });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'OTP expired or not found' });
  }

  const isValidOtp = await bcrypt.compare(otp, record.otpHash);
  if (!isValidOtp) {
    record.attempts += 1;
    await record.save();
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid OTP' });
  }

  await OtpCode.deleteMany({ mobileNumber });

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
      passwordHash
    });
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

module.exports = { register, login, requestOtp, verifyOtp };