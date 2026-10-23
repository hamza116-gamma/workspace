const mongoose = require('mongoose');
const Draft = require('../models/draft.model');
const { AppError } = require('../utils/AppError');
const { MESSAGE_MAX_LENGTH } = require('../utils/validation');
const channelService = require('./channel.service');
const conversationService = require('./conversation.service');
const messageService = require('./message.service');

const idOf = (ref) => (ref ? String(ref._id ?? ref) : null);

const keyFor = ({ channel, conversation, threadRoot }) => {
  if (threadRoot) return `thread:${idOf(threadRoot)}`;
  if (channel) return `channel:${idOf(channel)}`;
  return `conversation:${idOf(conversation)}`;
};

// Composer key of the composer that sent `message` (thread reply -> thread).
const keyForMessage = (message) =>
  keyFor({
    threadRoot: message.parentMessageId,
    channel: message.channel,
    conversation: message.conversation,
  });

const toPublicDraft = (draft) => ({
  id: draft._id,
  key: draft.key,
  channelId: idOf(draft.channel),
  conversationId: idOf(draft.conversation),
  threadRootId: idOf(draft.threadRoot),
  content: draft.content,
  updatedAt: draft.updatedAt,
});

const validId = (value) => (value && mongoose.isValidObjectId(value) ? value : null);

// Access is checked like messages: readable channel, DM participant, or a
// thread root the user can read.
const resolveTarget = async (organizationId, userId, body) => {
  const threadRootId = validId(body.threadRootId);
  if (threadRootId) {
    const root = await messageService.findByIdForOrg(threadRootId, organizationId);
    if (!root || root.parentMessageId) {
      throw new AppError(404, 'Thread not found');
    }
    await messageService.assertAccess(root, userId);
    return { channel: root.channel, conversation: root.conversation, threadRoot: root._id };
  }
  const channelId = validId(body.channelId);
  if (channelId) {
    const channel = await channelService.findById(channelId, organizationId);
    if (!channel) {
      throw new AppError(404, 'Channel not found');
    }
    await channelService.getAccessContext(channel, userId);
    return { channel: channel._id, conversation: null, threadRoot: null };
  }
  const conversationId = validId(body.conversationId);
  if (conversationId) {
    const conversation = await conversationService.findByIdForOrg(conversationId, organizationId);
    if (!conversation || !conversationService.getParticipant(conversation, userId)) {
      throw new AppError(404, 'Conversation not found');
    }
    return { channel: null, conversation: conversation._id, threadRoot: null };
  }
  throw new AppError(400, 'channelId, conversationId or threadRootId is required');
};

const listForUser = async (organizationId, userId) => {
  const drafts = await Draft.find({ organization: organizationId, user: userId }).sort({
    updatedAt: -1,
  });
  return drafts.map(toPublicDraft);
};

// Empty content deletes the draft. Returns { key, draft|null }.
const saveDraft = async (organizationId, userId, body = {}) => {
  const target = await resolveTarget(organizationId, userId, body);
  const key = keyFor(target);
  const content = typeof body.content === 'string' ? body.content : '';
  if (content.length > MESSAGE_MAX_LENGTH) {
    throw new AppError(400, `Draft must be at most ${MESSAGE_MAX_LENGTH} characters`);
  }
  const filter = { organization: organizationId, user: userId, key };
  if (!content.trim()) {
    await Draft.deleteOne(filter);
    return { key, draft: null };
  }
  const draft = await Draft.findOneAndUpdate(
    filter,
    { $set: { ...target, content } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { key, draft: toPublicDraft(draft) };
};

// Returns the deleted draft's key (or null when nothing was deleted).
const removeDraft = async (organizationId, userId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'Draft not found');
  }
  const draft = await Draft.findOneAndDelete({
    _id: id,
    organization: organizationId,
    user: userId,
  });
  if (!draft) {
    throw new AppError(404, 'Draft not found');
  }
  return draft.key;
};

// Sending a message clears that composer's draft. Returns true if deleted.
const clearForMessage = async (organizationId, userId, message) => {
  const result = await Draft.deleteOne({
    organization: organizationId,
    user: userId,
    key: keyForMessage(message),
  });
  return result.deletedCount > 0;
};

module.exports = { keyForMessage, listForUser, saveDraft, removeDraft, clearForMessage };
