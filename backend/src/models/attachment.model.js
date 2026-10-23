const mongoose = require('mongoose');
const { ATTACHMENT_KINDS } = require('../config/constants');

const attachmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    // Denormalized from the message so the channel/DM media browser can query
    // attachments directly without joining messages.
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: Object.values(ATTACHMENT_KINDS), required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: 'image' },
    format: { type: String, default: null },
    bytes: { type: Number, default: 0 },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
  },
  { timestamps: true },
);

attachmentSchema.index({ channel: 1, createdAt: -1 });
attachmentSchema.index({ publicId: 1 });
attachmentSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
