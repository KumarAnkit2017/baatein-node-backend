const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const { otpTtlSeconds, otpDebug } = require('../config/env');

const normalizePhone = (phone) => String(phone || '').replace(/\s+/g, '');

const toAuthPayload = (user) => {
  const token = signToken({ sub: user.id, email: user.email || '', mobileNumber: user.mobile_number || '' });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      mobileNumber: user.mobile_number || '',
      avatar: user.avatar,
      bio: user.bio
    }
  };
};

const register = async (req, res) => {
  const { name, email, password, mobileNumber } = req.body;

  const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existingEmail.rowCount) {
    return res.status(StatusCodes.CONFLICT).json({ message: 'Email already in use' });
  }

  const phone = mobileNumber ? normalizePhone(mobileNumber) : null;
  if (phone) {
    const existingPhone = await pool.query('SELECT id FROM users WHERE mobile_number = $1 LIMIT 1', [phone]);
    if (existingPhone.rowCount) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Mobile number already in use' });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await pool.query(
    `INSERT INTO users (name, email, mobile_number, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, mobile_number, avatar, bio`,
    [name, email, phone, passwordHash]
  );

  return res.status(StatusCodes.CREATED).json(toAuthPayload(inserted.rows[0]));
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    `SELECT id, name, email, mobile_number, avatar, bio, password_hash
     FROM users
     WHERE email = $1 AND is_active = true
     LIMIT 1`,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(user));
};

const requestOtp = async (req, res) => {
  const mobileNumber = normalizePhone(req.body.mobileNumber);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 10);

  await pool.query('DELETE FROM otp_codes WHERE mobile_number = $1 OR expires_at < now()', [mobileNumber]);
  await pool.query(
    `INSERT INTO otp_codes (mobile_number, otp_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [mobileNumber, otpHash, otpTtlSeconds]
  );

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

  const otpResult = await pool.query(
    `SELECT id, otp_hash, attempts, expires_at
     FROM otp_codes
     WHERE mobile_number = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [mobileNumber]
  );

  const record = otpResult.rows[0];
  if (!record || new Date(record.expires_at).getTime() < Date.now()) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'OTP expired or not found' });
  }

  const isValidOtp = await bcrypt.compare(otp, record.otp_hash);
  if (!isValidOtp) {
    await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid OTP' });
  }

  await pool.query('DELETE FROM otp_codes WHERE mobile_number = $1', [mobileNumber]);

  let userResult = await pool.query(
    `SELECT id, name, email, mobile_number, avatar, bio
     FROM users
     WHERE mobile_number = $1 AND is_active = true
     LIMIT 1`,
    [mobileNumber]
  );

  if (!userResult.rowCount) {
    const safeDigits = mobileNumber.replace(/\D/g, '');
    const name = providedName || `User ${safeDigits.slice(-4) || 'New'}`;
    const pseudoEmail = `mobile_${safeDigits || crypto.randomUUID()}@baatein.local`;
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

    userResult = await pool.query(
      `INSERT INTO users (name, email, mobile_number, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, mobile_number, avatar, bio`,
      [name, pseudoEmail, mobileNumber, passwordHash]
    );
  }

  return res.status(StatusCodes.OK).json(toAuthPayload(userResult.rows[0]));
};

module.exports = { register, login, requestOtp, verifyOtp };