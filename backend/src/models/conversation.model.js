const mongoose = require('mongoose');
const { CONVERSATION_TYPES } = require('../config/constants');

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
    muted: { type: Boolean, default: false },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(CONVERSATION_TYPES),
      default: CONVERSATION_TYPES.DIRECT,
    },
    participants: { type: [participantSchema], default: [] },
    // Only set for DIRECT conversations: "<organizationId>:<sortedUserIds>".
    // Unique + sparse so 1:1 DMs are never duplicated, while GROUP docs omit it.
    directKey: { type: String, unique: true, sparse: true },
    // Only set for GROUP conversations: same format as directKey. Unique +
    // sparse so a group with the exact same participants is reused.
    groupKey: { type: String, unique: true, sparse: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ organization: 1, 'participants.user': 1 });
conversationSchema.index({ organization: 1, lastActivityAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
