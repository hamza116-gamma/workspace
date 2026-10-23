const mongoose = require('mongoose');
const { HUDDLE_STATUS, HUDDLE_INVITE_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const participantSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    // null while the person is in the huddle.
    leftAt: { type: Date, default: null },
  },
  { _id: false },
);

const inviteSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    invitedBy: { type: ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: Object.values(HUDDLE_INVITE_STATUS),
      default: HUDDLE_INVITE_STATUS.RINGING,
    },
    invitedAt: { type: Date, default: Date.now },
    // Each invite rings for its own 30s window.
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const huddleSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true, index: true },
    channel: { type: ObjectId, ref: 'Channel', default: null },
    conversation: { type: ObjectId, ref: 'Conversation', default: null },
    startedBy: { type: ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(HUDDLE_STATUS),
      default: HUDDLE_STATUS.LIVE,
    },
    participants: { type: [participantSchema], default: [] },
    invites: { type: [inviteSchema], default: [] },
    hadVideo: { type: Boolean, default: false },
    hadScreenShare: { type: Boolean, default: false },
    // The call-log card in the chat (Message.huddle points back here).
    message: { type: ObjectId, ref: 'Message', default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    endedBy: { type: ObjectId, ref: 'User', default: null },
    // null = normal end; MISSED / DECLINED for unanswered DM calls.
    outcome: { type: String, enum: [null, 'MISSED', 'DECLINED'], default: null },
  },
  { timestamps: true },
);

huddleSchema.pre('validate', function ensureSingleTarget(next) {
  if (Boolean(this.channel) === Boolean(this.conversation)) {
    next(new Error('A huddle must reference exactly one channel or conversation'));
    return;
  }
  next();
});

// At most one LIVE huddle per channel / per conversation.
huddleSchema.index(
  { channel: 1 },
  {
    unique: true,
    partialFilterExpression: { status: HUDDLE_STATUS.LIVE, channel: { $type: 'objectId' } },
  },
);
huddleSchema.index(
  { conversation: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: HUDDLE_STATUS.LIVE,
      conversation: { $type: 'objectId' },
    },
  },
);
huddleSchema.index({ organization: 1, status: 1 });
huddleSchema.index({ channel: 1, createdAt: -1 });
huddleSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Huddle', huddleSchema);
