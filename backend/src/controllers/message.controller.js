const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const messageService = require('../services/message.service');
const auditService = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../config/constants');
const reactionService = require('../services/reaction.service');
const threadService = require('../services/thread.service');
const conversationService = require('../services/conversation.service');
const draftService = require('../services/draft.service');
const { notify, emitUnread } = require('../sockets/messageDelivery');
const { emitDraftUpdated } = require('../sockets/draftEvents');
const {
  serializeLive,
  emitCreated,
  emitToMessageRooms,
  emitThreadUpdated,
} = require('../sockets/messageEvents');
const {
  serializeMessage: serialize,
  serializeMessages: serializeMany,
} = require('../services/serialize.service');

const getIo = (req) => req.app.get('io');

// Sending a message deletes that composer's draft (other tabs are told).
const clearDraft = async (io, organizationId, user, message) => {
  const cleared = await draftService.clearForMessage(organizationId, user._id, message);
  if (cleared) {
    const key = draftService.keyForMessage(message);
    emitDraftUpdated(io, organizationId, user._id, key, null);
  }
};

const deliver = async (io, organizationId, user, message, conversation = null) => {
  const context = { message, actor: user, organizationId, conversation };
  await emitCreated(io, message, organizationId);
  await notify(io, context);
  await emitUnread(io, context);
  await clearDraft(io, organizationId, user, message);
};

const emitConversationActivity = (io, conversation) => {
  if (!io) {
    return;
  }
  (conversation.participants || []).forEach((participant) => {
    const userId = String(participant.user?._id ?? participant.user);
    io.to(`user:${userId}`).emit('conversation.updated', {
      conversationId: String(conversation._id),
      lastActivityAt: conversation.lastActivityAt,
    });
  });
};

/**
 * The one message-creation pipeline (HTTP sends and the scheduler): create,
 * broadcast, notify, unread, clear the draft, DM activity. Access checks are
 * the caller's job (routes / scheduler); createMessage re-checks channel
 * write access.
 *   target: { channel } | { conversation } (documents)
 */
const postMessage = async ({ io, organizationId, user, target, body }) => {
  const message = await messageService.createMessage(
    {
      organization: organizationId,
      channel: target.channel?._id || null,
      conversation: target.conversation?._id || null,
    },
    user,
    body,
  );
  if (target.conversation) {
    await conversationService.touchActivity(target.conversation, message.createdAt);
  }
  await deliver(io, organizationId, user, message, target.conversation || null);
  if (target.conversation) {
    emitConversationActivity(io, target.conversation);
  }
  return message;
};

const listChannel = asyncHandler(async (req, res) => {
  const messages = await messageService.listChannelMessages(req.channel._id, req.query);
  success(res, { messages: await serializeMany(messages, req.user._id) });
});

const createChannel = asyncHandler(async (req, res) => {
  const message = await postMessage({
    io: getIo(req),
    organizationId: req.organization._id,
    user: req.user,
    target: { channel: req.channel },
    body: req.body,
  });
  success(res, { message: await serialize(message, req.user._id) }, 201);
});

const listConversation = asyncHandler(async (req, res) => {
  const messages = await messageService.listConversationMessages(req.conversation._id, req.query);
  success(res, { messages: await serializeMany(messages, req.user._id) });
});

const createConversation = asyncHandler(async (req, res) => {
  const message = await postMessage({
    io: getIo(req),
    organizationId: req.organization._id,
    user: req.user,
    target: { conversation: req.conversation },
    body: req.body,
  });
  success(res, { message: await serialize(message, req.user._id) }, 201);
});

// write: the action changes the message or its channel state, so deleted
//        messages are rejected and channel messages need an active
//        membership in a non-archived channel.
// live:  only reject deleted messages (e.g. deleting twice).
const loadMessage = async (req, { write = false, live = write } = {}) => {
  const message = await messageService.findByIdForOrg(req.params.messageId, req.organization._id);
  if (!message || (live && message.deletedAt)) {
    throw new AppError(404, 'Message not found');
  }
  await messageService.assertAccess(message, req.user._id);
  if (write) {
    await messageService.assertCanWrite(message, req.user._id);
  }
  return message;
};

const thread = asyncHandler(async (req, res) => {
  const found = await loadMessage(req);
  const rootId = found.parentMessageId ? found.parentMessageId : found._id;
  const root = found.parentMessageId
    ? await messageService.findByIdForOrg(found.parentMessageId, req.organization._id)
    : found;

  const replies = await messageService.listThread(rootId, req.query);
  const following = await threadService.isFollowing(rootId, req.user._id);

  success(res, {
    message: await serialize(root, req.user._id),
    replies: await serializeMany(replies, req.user._id),
    following,
  });
});

const followThread = asyncHandler(async (req, res) => {
  const found = await loadMessage(req, { write: true });
  const rootId = found.parentMessageId ? found.parentMessageId : found._id;
  await threadService.follow(req.organization._id, rootId, req.user._id);
  success(res, { following: true });
});

const unfollowThread = asyncHandler(async (req, res) => {
  const found = await loadMessage(req);
  const rootId = found.parentMessageId ? found.parentMessageId : found._id;
  await threadService.unfollow(rootId, req.user._id);
  success(res, { following: false });
});

const update = asyncHandler(async (req, res) => {
  const message = await loadMessage(req, { write: true });
  const updated = await messageService.updateMessage(message, req.user._id, req.body.content);
  emitToMessageRooms(getIo(req), updated, 'message.updated', {
    message: await serializeLive(updated),
  });
  success(res, { message: await serialize(updated, req.user._id) });
});

// Admins/moderators deleting someone else's channel message are audited.
const auditAdminDelete = async (req, message) => {
  const senderId = String(message.sender?._id ?? message.sender);
  if (!message.channel || senderId === String(req.user._id)) {
    return;
  }
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.MESSAGE_DELETED_BY_ADMIN,
    message.sender?._id
      ? auditService.userTarget(message.sender)
      : { type: 'user', id: senderId, label: '' },
    { channelId: String(message.channel?._id ?? message.channel) },
  );
};

const remove = asyncHandler(async (req, res) => {
  const message = await loadMessage(req, { live: true });
  // Authors may delete their own messages even after leaving the channel;
  // moderators need the normal write access.
  if (String(message.sender?._id ?? message.sender) !== String(req.user._id)) {
    await messageService.assertCanWrite(message, req.user._id);
  }
  const deleted = await messageService.deleteMessage(message, req.user._id, {
    orgRole: req.membership?.role,
  });
  await auditAdminDelete(req, deleted);
  const io = getIo(req);
  const payload = { message: await serializeLive(deleted) };
  emitToMessageRooms(io, deleted, 'message.deleted', payload);
  if (deleted.parentMessageId) {
    await emitThreadUpdated(io, deleted.parentMessageId, req.organization._id);
  }
  success(res, payload);
});

const toggleReaction = asyncHandler(async (req, res) => {
  const message = await loadMessage(req, { write: true });
  await reactionService.toggleReaction(message, req.user, req.body.emoji);
  const live = await serializeLive(message);
  emitToMessageRooms(getIo(req), message, 'message.updated', { message: live });
  if (!message.parentMessageId && message.replyCount > 0) {
    getIo(req)?.to(`thread:${message._id}`).emit('thread.updated', { message: live });
  }
  success(res, { message: await serialize(message, req.user._id) });
});

module.exports = {
  postMessage,
  listChannel,
  createChannel,
  listConversation,
  createConversation,
  thread,
  followThread,
  unfollowThread,
  update,
  remove,
  toggleReaction,
};
