const mongoose = require('mongoose');
const { CHANNEL_ROLES, CHANNEL_NOTIFY, CHANNEL_MEMBER_STATUS } = require('../config/constants');

const channelMemberSchema = new mongoose.Schema(
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
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: Object.values(CHANNEL_ROLES),
      default: CHANNEL_ROLES.MEMBER,
    },
    notifyPreference: {
      type: String,
      enum: Object.values(CHANNEL_NOTIFY),
      default: CHANNEL_NOTIFY.ALL,
    },
    status: {
      type: String,
      enum: Object.values(CHANNEL_MEMBER_STATUS),
      default: CHANNEL_MEMBER_STATUS.ACTIVE,
    },
    starred: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

channelMemberSchema.index({ channel: 1, user: 1 }, { unique: true });
channelMemberSchema.index({ organization: 1, user: 1 });

module.exports = mongoose.model('ChannelMember', channelMemberSchema);
