const mongoose = require('mongoose');

const channelPinSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

channelPinSchema.index({ channel: 1, message: 1 }, { unique: true });

module.exports = mongoose.model('ChannelPin', channelPinSchema);
