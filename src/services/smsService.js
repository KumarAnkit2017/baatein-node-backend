const twilio = require('twilio');
const { otpDebug, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = require('../config/env');

const canSendSms = Boolean(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);

const normalizeToE164 = (mobileNumber) => {
  const phone = String(mobileNumber || '').replace(/\D/g, '');
  if (!phone) return '';
  if (phone.startsWith('91') && phone.length === 12) return `+${phone}`;
  if (phone.length === 10) return `+91${phone}`;
  return `+${phone}`;
};

const sendSmsOtp = async ({ mobileNumber, otp, ttlSeconds }) => {
  if (!mobileNumber) {
    throw new Error('Mobile number is required');
  }

  const to = normalizeToE164(mobileNumber);
  if (!to) {
    throw new Error('Invalid mobile number');
  }

  if (!canSendSms) {
    if (otpDebug) {
      console.log(`[otp][sms] ${to}: ${otp}`);
      return { delivered: false, debugOnly: true, skipped: true };
    }
    return { delivered: false, configured: false, skipped: true };
  }

  const ttlMinutes = Math.max(1, Math.ceil(Number(ttlSeconds || 300) / 60));
  const client = twilio(twilioAccountSid, twilioAuthToken);
  const message = await client.messages.create({
    body: `Your Baatein OTP is ${otp}. Valid for ${ttlMinutes} minutes. Do not share with anyone.`,
    from: twilioPhoneNumber,
    to
  });

  console.log(`OTP SMS sent to ${to} - SID: ${message.sid}`);
  return { delivered: true, debugOnly: false, sid: message.sid };
};

module.exports = { canSendSms, sendSmsOtp, normalizeToE164 };
