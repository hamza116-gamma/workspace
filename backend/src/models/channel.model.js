const mongoose = require('mongoose');
const { CHANNEL_TYPES, CHANNEL_STATUS } = require('../config/constants');

const channelSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, lowercase: true },
    topic: { type: String, default: '' },
    purpose: { type: String, default: '' },
    type: {
      type: String,
      enum: Object.values(CHANNEL_TYPES),
      default: CHANNEL_TYPES.PUBLIC,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(CHANNEL_STATUS),
      default: CHANNEL_STATUS.ACTIVE,
    },
    // The workspace default channel (#general): everyone is a member and it
    // can't be left, archived or have members removed.
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

channelSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Channel', channelSchema);
