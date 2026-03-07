const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema(
  {
    mobileNumber: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpCode', otpCodeSchema);