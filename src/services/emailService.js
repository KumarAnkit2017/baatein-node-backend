const nodemailer = require('nodemailer');
const { mailFrom, mailHost, mailPass, mailPort, mailSecure, mailUser, otpDebug } = require('../config/env');

let transporter;

const canSendEmail = Boolean(mailUser && mailPass);

const getTransporter = () => {
  if (!canSendEmail) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      auth: {
        user: mailUser,
        pass: mailPass
      }
    });
  }
  return transporter;
};

const buildSubject = (purpose) => {
  if (purpose === 'login-email') return 'Baatein login verification code';
  return 'Verify your Baatein email';
};

const buildHtml = ({ name, otp, ttlMinutes, purpose }) => {
  const title = purpose === 'login-email' ? 'Login verification' : 'Email verification';
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#10243c;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #d9e4f2;">
        <div style="font-size:24px;font-weight:800;margin-bottom:8px;">Baatein</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:12px;">${title}</div>
        <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Hello ${name || 'there'},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">Use this one-time code to continue securely in Baatein.</p>
        <div style="font-size:34px;letter-spacing:8px;font-weight:800;text-align:center;background:#0f2f4d;color:#ffffff;border-radius:14px;padding:18px 12px;margin-bottom:18px;">${otp}</div>
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;">This code expires in ${ttlMinutes} minute(s).</p>
        <p style="font-size:13px;line-height:1.6;margin:0;color:#60758f;">If you did not request this, you can ignore this email.</p>
      </div>
    </div>
  `;
};

const sendEmailOtp = async ({ to, name, otp, ttlSeconds, purpose = 'verify-email' }) => {
  if (!to) {
    throw new Error('Recipient email is required');
  }

  const ttlMinutes = Math.max(1, Math.ceil(Number(ttlSeconds || 300) / 60));
  const transport = getTransporter();

  if (!transport) {
    if (otpDebug) {
      console.log(`[otp][email] ${to}: ${otp}`);
      return { delivered: false, debugOnly: true };
    }
    return { delivered: false, configured: false };
  }

  await transport.sendMail({
    from: mailFrom || mailUser,
    to,
    subject: buildSubject(purpose),
    text: `Your Baatein verification code is ${otp}. It expires in ${ttlMinutes} minute(s).`,
    html: buildHtml({ name, otp, ttlMinutes, purpose })
  });

  return { delivered: true, debugOnly: false };
};

module.exports = { canSendEmail, sendEmailOtp };
