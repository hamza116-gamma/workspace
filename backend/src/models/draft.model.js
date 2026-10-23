const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// One unsent composer text per user + workspace + composer key:
//   channel:<id> | conversation:<id> | thread:<rootId>
const draftSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    channel: { type: ObjectId, ref: 'Channel', default: null },
    conversation: { type: ObjectId, ref: 'Conversation', default: null },
    threadRoot: { type: ObjectId, ref: 'Message', default: null },
    content: { type: String, default: '' },
  },
  { timestamps: true },
);

draftSchema.index({ user: 1, organization: 1, key: 1 }, { unique: true });
draftSchema.index({ user: 1, organization: 1, updatedAt: -1 });

module.exports = mongoose.model('Draft', draftSchema);
