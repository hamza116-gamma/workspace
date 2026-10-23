const mongoose = require('mongoose');

const threadFollowSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    threadRoot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

threadFollowSchema.index({ threadRoot: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ThreadFollow', threadFollowSchema);
