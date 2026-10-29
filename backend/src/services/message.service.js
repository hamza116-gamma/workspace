const mongoose = require('mongoose');
const Message = require('../models/message.model');
const Task = require('../models/task.model');
const ChannelMember = require('../models/channelMember.model');
const OrganizationMember = require('../models/organizationMember.model');
const { AppError } = require('../utils/AppError');
const { assertMessageContent, assertOptionalMessageContent } = require('../utils/validation');
const { parseMentions } = require('../utils/mentions');
const { extractLinks } = require('../utils/links');
const {
  CHANNEL_ROLES,
  CHANNEL_MEMBER_STATUS,
  ORG_ROLES,
  MEMBER_STATUS,
} = require('../config/constants');
const { toPublicUser } = require('./user.service');
const channelService = require('./channel.service');
const conversationService = require('./conversation.service');
const attachmentService = require('./attachment.service');
const pinService = require('./pin.service');
const threadService = require('./thread.service');
const savedService = require('./saved.service');
const notificationService = require('./notification.service');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const toPublicMessage = (message, reactions = [], attachments = [], task = null) => ({
  id: message._id,
  channelId: message.channel ? String(message.channel) : null,
  conversationId: message.conversation ? String(message.conversation) : null,
  sender:
    message.sender && message.sender.fullName
      ? toPublicUser(message.sender)
      : { id: String(message.sender) },
  content: message.content,
  parentMessageId: message.parentMessageId ? String(message.parentMessageId) : null,
  alsoSentToChannel: Boolean(message.alsoSentToChannel),
  replyCount: message.replyCount || 0,
  lastReplyAt: message.lastReplyAt || null,
  replyUserIds: (message.replyUserIds || []).map(String),
  mentions: (message.mentionedUserIds || []).map((user) =>
    user && user.fullName
      ? { id: String(user._id), fullName: user.fullName }
      : { id: String(user) },
  ),
  mentionAll: Boolean(message.mentionAll),
  mentionHere: Boolean(message.mentionHere),
  links: message.links || [],
  huddleId: message.huddle ? String(message.huddle._id ?? message.huddle) : null,
  // A ticket card (legacy) or the chip of a message turned into a ticket.
  taskId: message.task
    ? String(message.task._id ?? message.task)
    : message.taskRef
      ? String(message.taskRef._id ?? message.taskRef)
      : null,
  ticketThread: Boolean(message.ticketThread),
  activity: Boolean(message.activity),
  task,
  reactions,
  attachments,
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const clampLimit = (limit) => {
  const value = Number(limit) || DEFAULT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_LIMIT);
};

const normalizeCursor = (before) => (before && mongoose.isValidObjectId(before) ? before : null);

// `before` pages older history (newest first, returned ascending); `after`
// pages newer messages back in (ascending) when the client window was
// trimmed at the newest end (frontend MAX_LOADED / hasNewer).
const listMessages = async (target, { before, after, limit } = {}) => {
  // Thread replies are hidden from the main list unless "also sent to
  // channel" (they still live in their thread).
  // A deleted ROOT that still has replies stays listed as a placeholder so
  // its thread remains reachable.
  const query = {
    ...target,
    $and: [
      // Ticket threads (hidden anchor + replies) never appear in the chat.
      { ticketThread: { $ne: true } },
      { $or: [{ parentMessageId: null }, { alsoSentToChannel: true }] },
      { $or: [{ deletedAt: null }, { parentMessageId: null, replyCount: { $gt: 0 } }] },
    ],
  };
  const afterCursor = normalizeCursor(after);
  const cursor = afterCursor ? null : normalizeCursor(before);
  if (afterCursor) {
    query._id = { $gt: afterCursor };
  } else if (cursor) {
    query._id = { $lt: cursor };
  }

  const messages = await Message.find(query)
    .sort({ _id: afterCursor ? 1 : -1 })
    .limit(clampLimit(limit))
    .populate('sender')
    .populate('mentionedUserIds');

  return afterCursor ? messages : messages.reverse();
};

const listThread = async (rootId, { before, limit } = {}) => {
  const query = { parentMessageId: rootId, deletedAt: null };
  const cursor = normalizeCursor(before);
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const messages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(clampLimit(limit))
    .populate('sender')
    .populate('mentionedUserIds');

  return messages.reverse();
};

const listChannelMessages = (channelId, options) => listMessages({ channel: channelId }, options);

const listConversationMessages = (conversationId, options) =>
  listMessages({ conversation: conversationId }, options);

const canMentionAll = async (target, actorId) => {
  if (!target.channel) {
    return false;
  }
  const [channelMember, orgMember] = await Promise.all([
    ChannelMember.findOne({
      channel: target.channel,
      user: actorId,
      status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
    }),
    OrganizationMember.findOne({
      organization: target.organization,
      user: actorId,
      status: MEMBER_STATUS.ACTIVE,
    }),
  ]);
  const isModerator = channelMember && channelMember.role === CHANNEL_ROLES.MODERATOR;
  const isAdmin = orgMember && [ORG_ROLES.OWNER, ORG_ROLES.ADMIN].includes(orgMember.role);
  return Boolean(isModerator || isAdmin);
};

const filterMentionable = async (target, userIds) => {
  if (!userIds.length) {
    return [];
  }
  if (target.channel) {
    const rows = await ChannelMember.find({
      channel: target.channel,
      user: { $in: userIds },
      status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
    }).select('user');
    return rows.map((row) => row.user);
  }
  if (target.conversation) {
    const conversation = await conversationService.findByIdForOrg(
      target.conversation,
      target.organization,
    );
    const participantIds = new Set(
      (conversation?.participants || []).map((participant) =>
        String(participant.user?._id ?? participant.user),
      ),
    );
    return userIds.filter((id) => participantIds.has(String(id)));
  }
  return [];
};

// Ticket comments: people who can be on the ticket (project members,
// including linked channels). @channel / @here are not allowed there.
const resolveTicketMentions = async (ticket, content) => {
  const parsed = parseMentions(content);
  if (parsed.all || parsed.here) {
    throw new AppError(400, '@channel and @here cannot be used in ticket comments');
  }
  const service = ticketAccess();
  const allowed = new Set(
    (
      await service.listAssignableUsers(
        ticket.organization,
        service.targetOf(ticket),
        await service.projectOf(ticket),
      )
    ).map((user) => String(user.id)),
  );
  return {
    mentionedUserIds: parsed.userIds.filter((id) => allowed.has(String(id))),
    mentionAll: false,
    mentionHere: false,
  };
};

const resolveMentions = async (target, actorId, content) => {
  const parsed = parseMentions(content);
  if ((parsed.all || parsed.here) && !(await canMentionAll(target, actorId))) {
    throw new AppError(403, 'You do not have permission to mention @channel or @here');
  }
  const mentionedUserIds = await filterMentionable(target, parsed.userIds);
  return { mentionedUserIds, mentionAll: parsed.all, mentionHere: parsed.here };
};

// Replying follows the thread; the root author is followed on the first reply.
const autoFollowThread = async (organizationId, rootId, replierId) => {
  const root = await Message.findById(rootId).select('sender replyCount');
  const follows = [threadService.follow(organizationId, rootId, replierId)];
  if (root && root.replyCount <= 1 && String(root.sender) !== String(replierId)) {
    follows.push(threadService.follow(organizationId, rootId, root.sender));
  }
  await Promise.all(follows);
};

const createMessage = async (target, actor, payload) => {
  const attachmentRefs = Array.isArray(payload.attachments) ? payload.attachments : [];
  const content = attachmentRefs.length
    ? assertOptionalMessageContent(payload.content)
    : assertMessageContent(payload.content);
  const targetRef = {
    organization: target.organization,
    channel: target.channel || null,
    conversation: target.conversation || null,
  };

  let parentMessageId = null;
  let alsoSentToChannel = false;
  // Replying in a ticket's own thread (comment): access follows the ticket.
  let ticket = null;
  const parent =
    payload.parentMessageId && mongoose.isValidObjectId(payload.parentMessageId)
      ? await Message.findById(payload.parentMessageId)
      : null;
  if (parent?.ticketThread) {
    ticket = await ticketOf(parent);
    if (!ticket) {
      throw new AppError(404, 'Thread not found');
    }
    await ticketAccess().assertCanWriteTask(ticket, actor._id);
  } else if (target.channel) {
    // Defence in depth: routes already enforce this for channel posts.
    await channelService.assertCanWriteById(target.channel, target.organization, actor._id);
  }

  if (payload.parentMessageId && mongoose.isValidObjectId(payload.parentMessageId)) {
    if (
      !parent ||
      parent.deletedAt ||
      String(parent.organization) !== String(target.organization)
    ) {
      throw new AppError(404, 'Thread not found');
    }
    if (target.channel && String(parent.channel) !== String(target.channel)) {
      throw new AppError(400, 'This thread belongs to another channel');
    }
    if (target.conversation && String(parent.conversation) !== String(target.conversation)) {
      throw new AppError(400, 'This thread belongs to another conversation');
    }
    // Flat threads: a reply's parent is always the thread root.
    parentMessageId = parent.parentMessageId ? parent.parentMessageId : parent._id;
    // Ticket comments never go to the channel.
    alsoSentToChannel = ticket ? false : Boolean(payload.alsoSendToChannel);
  }

  const mentions = ticket
    ? await resolveTicketMentions(ticket, content)
    : await resolveMentions(targetRef, actor._id, content);

  let message;
  try {
    message = await Message.create({
      organization: target.organization,
      channel: target.channel || null,
      conversation: target.conversation || null,
      sender: actor._id,
      content,
      parentMessageId,
      alsoSentToChannel,
      ticketThread: Boolean(ticket),
      project: ticket && !target.channel && !target.conversation ? ticket.project : null,
      links: extractLinks(content),
      ...mentions,
    });

    if (attachmentRefs.length) {
      await attachmentService.createForMessage(
        target.organization,
        message,
        attachmentRefs,
        actor._id,
      );
    }
  } catch (error) {
    // Never leave a half-created (empty) message behind if the attachments
    // could not be stored.
    if (message) {
      await Message.deleteOne({ _id: message._id });
    }
    throw error;
  }

  if (parentMessageId) {
    await Message.updateOne(
      { _id: parentMessageId },
      {
        $inc: { replyCount: 1 },
        $set: { lastReplyAt: message.createdAt },
        $addToSet: { replyUserIds: actor._id },
      },
    );
    await autoFollowThread(target.organization, parentMessageId, actor._id);
  }

  await message.populate('sender');
  await message.populate('mentionedUserIds');
  return message;
};

const findByIdForOrg = (id, organizationId) =>
  Message.findOne({ _id: id, organization: organizationId })
    .populate('sender')
    .populate('mentionedUserIds');

// The ticket a ticket-thread message belongs to (its anchor's task).
const ticketOf = (message) => Task.findOne({ message: message.parentMessageId || message._id });

// Lazy: task.service is loaded on first use (keeps require order simple).
const ticketAccess = () => require('./task.service');

const assertAccess = async (message, userId) => {
  // Ticket comments follow the ticket (project members incl. linked channels).
  if (message.ticketThread) {
    const task = await ticketOf(message);
    if (!task) {
      throw new AppError(404, 'Message not found');
    }
    await ticketAccess().assertCanReadTask(task, userId);
    return;
  }
  if (message.channel) {
    const channel = await channelService.findById(message.channel, message.organization);
    if (!channel) {
      throw new AppError(404, 'Message not found');
    }
    await channelService.getAccessContext(channel, userId);
    return;
  }

  if (message.conversation) {
    const conversation = await conversationService.findByIdForOrg(
      message.conversation,
      message.organization,
    );
    if (!conversation || !conversationService.getParticipant(conversation, userId)) {
      throw new AppError(403, 'You do not have access to this message');
    }
  }
};

const assertSender = (message, userId) => {
  if (String(message.sender?._id ?? message.sender) !== String(userId)) {
    throw new AppError(403, 'You can only change your own messages');
  }
};

const updateMessage = async (message, userId, content) => {
  if (message.deletedAt) {
    throw new AppError(404, 'Message not found');
  }
  assertSender(message, userId);
  if (message.huddle) {
    throw new AppError(403, 'Huddle cards cannot be edited');
  }
  const next = assertMessageContent(content);
  const targetRef = {
    organization: message.organization,
    channel: message.channel,
    conversation: message.conversation,
  };

  const mentions = await resolveMentions(targetRef, userId, next);
  message.content = next;
  message.mentionedUserIds = mentions.mentionedUserIds;
  message.mentionAll = mentions.mentionAll;
  message.mentionHere = mentions.mentionHere;
  message.links = extractLinks(next);
  message.editedAt = new Date();
  await message.save();
  await message.populate('mentionedUserIds');
  return message;
};

// Message-level write gate (edit / delete / react / pin): channel messages
// need an active membership in a non-archived channel.
const assertCanWrite = async (message, userId) => {
  if (message.ticketThread) {
    const task = await ticketOf(message);
    if (!task) {
      throw new AppError(404, 'Message not found');
    }
    await ticketAccess().assertCanWriteTask(task, userId);
    return;
  }
  if (message.channel) {
    await channelService.assertCanWriteById(message.channel, message.organization, userId);
  }
};

// Channel moderators and org OWNER/ADMIN may delete anyone's CHANNEL message.
// DMs are never moderated.
const canModerate = async (message, userId, orgRole) => {
  if (!message.channel) {
    return false;
  }
  if ([ORG_ROLES.OWNER, ORG_ROLES.ADMIN].includes(orgRole)) {
    return true;
  }
  const member = await ChannelMember.findOne({
    channel: message.channel,
    user: userId,
    status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
  }).select('role');
  return Boolean(member && member.role === CHANNEL_ROLES.MODERATOR);
};

const isSender = (message, userId) =>
  String(message.sender?._id ?? message.sender) === String(userId);

const deleteMessage = async (message, userId, { orgRole } = {}) => {
  if (!isSender(message, userId) && !(await canModerate(message, userId, orgRole))) {
    throw new AppError(403, 'You can only delete your own messages');
  }
  await attachmentService.removeForMessage(message);
  await pinService.removeForMessage(message._id);
  await savedService.removeForMessage(message._id);
  await notificationService.removeForMessage(message._id);
  // Deleting a task card deletes the task (its thread replies stay).
  if (message.task) {
    await Task.deleteOne({ _id: message.task, message: message._id });
    message.task = null;
  }
  message.deletedAt = new Date();
  message.content = '';
  message.links = [];
  await message.save();
  if (message.parentMessageId) {
    await refreshThreadStats(message.parentMessageId);
  }
  return message;
};

// After a reply is deleted: recompute the root's replyCount, replyUserIds
// and lastReplyAt from the remaining live replies.
const refreshThreadStats = async (rootId) => {
  const replies = await Message.find({ parentMessageId: rootId, deletedAt: null })
    .sort({ createdAt: 1 })
    .select('sender createdAt');
  const replyUserIds = [...new Set(replies.map((reply) => String(reply.sender)))];
  await Message.updateOne(
    { _id: rootId },
    {
      $set: {
        replyCount: replies.length,
        replyUserIds,
        lastReplyAt: replies.length ? replies[replies.length - 1].createdAt : null,
      },
    },
  );
};

// Huddle call-log card: a plain system-style message linked to the huddle.
// Content is server-written ("Huddle started", later "Huddle ended · …").
const attachHuddle = async (target, actorId, huddleId, content) => {
  const message = await Message.create({
    organization: target.organization,
    channel: target.channel || null,
    conversation: target.conversation || null,
    sender: actorId,
    content,
    huddle: huddleId,
  });
  await message.populate('sender');
  return message;
};

const rewriteHuddleCard = async (messageId, content) => {
  const message = await Message.findOneAndUpdate(
    { _id: messageId, huddle: { $ne: null } },
    { $set: { content } },
    { new: true },
  );
  if (message) {
    await message.populate('sender');
  }
  return message;
};

module.exports = {
  toPublicMessage,
  attachHuddle,
  rewriteHuddleCard,
  listChannelMessages,
  listConversationMessages,
  listThread,
  createMessage,
  findByIdForOrg,
  assertAccess,
  assertSender,
  assertCanWrite,
  canModerate,
  updateMessage,
  deleteMessage,
};
