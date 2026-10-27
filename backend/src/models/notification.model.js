const mongoose = require('mongoose');

const NOTIFICATION_TYPES = {
  MENTION: 'MENTION',
  DM: 'DM',
  THREAD_REPLY: 'THREAD_REPLY',
  CHANNEL: 'CHANNEL',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_DUE: 'TASK_DUE',
};

const notificationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    snippet: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ organization: 1, recipient: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
