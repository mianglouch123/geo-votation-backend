// backend/src/models/email.log.model.js
import mongoose from "mongoose";

const EmailLogSchema = new mongoose.Schema({
  to: { type: String, required: true },
  type: { type: String, enum: ['VERIFICATION', 'PASSWORD_RESET', 'ANSWER_SUBMITTED', 'ANSWER_UPDATED', 'INVITATION'], required: true },
  subject: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
  error: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  sentAt: { type: Date, default: Date.now }
});

export const EmailLogModel = mongoose.model('EmailLog', EmailLogSchema);