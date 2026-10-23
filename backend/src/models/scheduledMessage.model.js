const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const SCHEDULED_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

// A text message the author asked to send later (channel, DM or thread
// reply). services/scheduler.js claims due items and posts them through the
// normal message pipeline.
const scheduledMessageSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    channel: { type: ObjectId, ref: 'Channel', default: null },
    conversation: { type: ObjectId, ref: 'Conversation', default: null },
    parentMessageId: { type: ObjectId, ref: 'Message', default: null },
    alsoSendToChannel: { type: Boolean, default: false },
    content: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SCHEDULED_STATUS),
      default: SCHEDULED_STATUS.PENDING,
    },
    claimedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    message: { type: ObjectId, ref: 'Message', default: null },
    error: { type: String, default: '' },
  },
  { timestamps: true },
);

scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ user: 1, organization: 1, status: 1, scheduledAt: 1 });

const ScheduledMessage = mongoose.model('ScheduledMessage', scheduledMessageSchema);

module.exports = ScheduledMessage;
module.exports.SCHEDULED_STATUS = SCHEDULED_STATUS;
