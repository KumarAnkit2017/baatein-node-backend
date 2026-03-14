const bcrypt = require('bcryptjs');
const OtpCode = require('../models/OtpCode');

const MAX_ATTEMPTS = 5;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const issueOtp = async ({ target, channel, purpose, userId, ttlSeconds }) => {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + Number(ttlSeconds || 300) * 1000);

  await OtpCode.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { target, channel, purpose }
    ]
  });

  await OtpCode.create({
    userId,
    target,
    channel,
    purpose,
    otpHash,
    expiresAt
  });

  return { otp, expiresAt };
};

const verifyOtpCode = async ({ target, channel, purpose, otp }) => {
  const record = await OtpCode.findOne({ target, channel, purpose }).sort({ createdAt: -1 });

  if (!record) {
    return { ok: false, reason: 'not_found' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await OtpCode.deleteMany({ target, channel, purpose });
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const matches = await bcrypt.compare(String(otp || ''), record.otpHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    return { ok: false, reason: 'invalid', attemptsRemaining: Math.max(0, MAX_ATTEMPTS - record.attempts) };
  }

  await OtpCode.deleteMany({ target, channel, purpose });
  return { ok: true, record };
};

module.exports = { issueOtp, verifyOtpCode };
