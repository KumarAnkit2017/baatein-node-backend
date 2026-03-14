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
  otpDebug: String(process.env.OTP_DEBUG || 'true').toLowerCase() === 'true',
  mailHost: process.env.MAIL_HOST || 'smtp.gmail.com',
  mailPort: Number(process.env.MAIL_PORT || 465),
  mailSecure: String(process.env.MAIL_SECURE || 'true').toLowerCase() === 'true',
  mailUser: process.env.MAIL_USER || '',
  mailPass: process.env.MAIL_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
  smsApiUrl: process.env.SMS_API_URL || '',
  smsApiKey: process.env.SMS_API_KEY || '',
  smsApiMethod: process.env.SMS_API_METHOD || 'POST',
  smsApiAuthHeader: process.env.SMS_API_AUTH_HEADER || 'x-api-key',
  smsSenderId: process.env.SMS_SENDER_ID || 'BAATEIN',
  smsTemplateId: process.env.SMS_TEMPLATE_ID || '',
  smsMessageTemplate: process.env.SMS_MESSAGE_TEMPLATE || 'Your Baatein verification code is {{otp}}. It expires in {{ttlMinutes}} minute(s).'
};
