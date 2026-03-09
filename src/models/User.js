const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
{
  name: { type: String, required: true, trim: true, maxlength: 80 },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true
  },

  mobileNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },

  passwordHash: {
    type: String,
    required: true,
    select: false
  },

  avatar: { type: String, default: '' },

  bio: { type: String, default: '', maxlength: 250 },

  isActive: { type: Boolean, default: true }
},
{ timestamps: true }
);

module.exports = mongoose.model('User', userSchema);