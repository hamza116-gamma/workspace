const mongoose = require('mongoose');
const { MESSAGE_MAX_LENGTH } = require('../utils/validation');

const messageSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      trim: true,
      maxlength: MESSAGE_MAX_LENGTH,
      default: '',
      // Content is validated in message.service (required unless the message
      // carries attachments, and cleared on delete).
    },
    // For thread replies this is the thread ROOT message id (flat threads,
    // no nesting). Null for top-level messages.
    parentMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    // A thread reply that was also posted to the channel/DM.
    alsoSentToChannel: { type: Boolean, default: false },
    // Mentions parsed from the content (<@id>, <!channel>, <!here>).
    mentionedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mentionAll: { type: Boolean, default: false },
    mentionHere: { type: Boolean, default: false },
    // http(s) links parsed from the content (Files & links tab).
    links: { type: [String], default: [] },
    // Denormalized on the ROOT message for fast "N replies" rendering.
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date, default: null },
    replyUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Huddle call-log card (one per huddle; not editable).
    huddle: { type: mongoose.Schema.Types.ObjectId, ref: 'Huddle', default: null },
    // Task card (the message is the task's root; its thread is the discussion).
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    // A ticket's own thread (its hidden anchor and every reply under it). Never
    // shown in the channel, counted as unread or found by message search.
    ticketThread: { type: Boolean, default: false },
    // Chip on a chat message that was turned into a ticket ("-> WEB-12").
    taskRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.pre('validate', function ensureSingleTarget(next) {
  const hasChannel = Boolean(this.channel);
  const hasConversation = Boolean(this.conversation);
  if (hasChannel === hasConversation) {
    next(new Error('A message must reference exactly one channel or conversation'));
    return;
  }
  next();
});

messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ parentMessageId: 1, createdAt: 1 });
// _id cursor paging (history / thread "load older").
messageSchema.index({ channel: 1, _id: -1 });
messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ parentMessageId: 1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);
