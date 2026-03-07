const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/baatein',
  jwtSecret: process.env.JWT_SECRET || 'unsafe_dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || '*',
  redisUrl: process.env.REDIS_URL || '',
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
  otpDebug: String(process.env.OTP_DEBUG || 'true').toLowerCase() === 'true'
};