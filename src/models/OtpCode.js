const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    target: { type: String, required: true, index: true },
    channel: { type: String, enum: ['sms', 'email'], required: true, index: true },
    purpose: { type: String, enum: ['login-mobile', 'verify-email', 'login-email'], required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpCode', otpCodeSchema);
