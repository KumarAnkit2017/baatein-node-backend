const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' }
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);