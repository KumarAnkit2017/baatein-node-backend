const { otpDebug, smsApiAuthHeader, smsApiKey, smsApiMethod, smsApiUrl, smsMessageTemplate, smsSenderId, smsTemplateId } = require('../config/env');

const canSendSms = Boolean(smsApiUrl && smsApiKey);

const buildMessage = ({ otp, ttlSeconds }) => {
  const ttlMinutes = Math.max(1, Math.ceil(Number(ttlSeconds || 300) / 60));
  return String(smsMessageTemplate || 'Your Baatein verification code is {{otp}}. It expires in {{ttlMinutes}} minute(s).')
    .replace(/{{otp}}/g, otp)
    .replace(/{{ttlMinutes}}/g, String(ttlMinutes));
};

const sendSmsOtp = async ({ mobileNumber, otp, ttlSeconds }) => {
  if (!mobileNumber) {
    throw new Error('Mobile number is required');
  }

  if (!canSendSms) {
    if (otpDebug) {
      console.log(`[otp][sms] ${mobileNumber}: ${otp}`);
      return { delivered: false, debugOnly: true };
    }
    return { delivered: false, configured: false };
  }

  const headers = {
    'Content-Type': 'application/json',
    [smsApiAuthHeader || 'x-api-key']: smsApiKey
  };

  const response = await fetch(smsApiUrl, {
    method: String(smsApiMethod || 'POST').toUpperCase(),
    headers,
    body: JSON.stringify({
      to: mobileNumber,
      mobileNumber,
      senderId: smsSenderId,
      templateId: smsTemplateId,
      otp,
      message: buildMessage({ otp, ttlSeconds })
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'SMS provider rejected the request');
  }

  return { delivered: true, debugOnly: false };
};

module.exports = { canSendSms, sendSmsOtp };
