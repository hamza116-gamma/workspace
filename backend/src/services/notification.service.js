const Notification = require('../models/notification.model');
const { toPublicUser } = require('./user.service');

const SNIPPET_MAX = 160;

const buildSnippet = (message) => {
  const content = String(message.content || '').trim();
  if (content) {
    return content.length > SNIPPET_MAX ? `${content.slice(0, SNIPPET_MAX)}…` : content;
  }
  const attachments = Array.isArray(message.attachments) ? message.attachments.length : 0;
  if (attachments > 0) {
    return attachments === 1 ? '📎 Sent an attachment' : `📎 Sent ${attachments} attachments`;
  }
  return '';
};

const toPublicNotification = (notification) => ({
  id: notification._id,
  type: notification.type,
  actor:
    notification.actor && notification.actor.fullName
      ? toPublicUser(notification.actor)
      : { id: String(notification.actor) },
  messageId: String(notification.message?._id ?? notification.message),
  channelId: notification.channel ? String(notification.channel) : null,
  conversationId: notification.conversation ? String(notification.conversation) : null,
  snippet: notification.snippet,
  readAt: notification.readAt,
  createdAt: notification.createdAt,
});

// Creates notifications for a set of recipients (deduped by user, one per
// user). Returns the created docs (publicly shaped for the socket payload).
const createForRecipients = async (organizationId, message, actor, recipients) => {
  const docs = [];
  const seen = new Set();
  recipients.forEach((recipient) => {
    if (seen.has(recipient.id)) {
      return;
    }
    seen.add(recipient.id);
    docs.push({
      organization: organizationId,
      recipient: recipient.id,
      actor: actor._id,
      type: recipient.type,
      message: message._id,
      channel: message.channel || null,
      conversation: message.conversation || null,
      snippet: buildSnippet(message),
    });
  });

  if (docs.length === 0) {
    return [];
  }

  const created = await Notification.insertMany(docs, { ordered: false });
  // insertMany returns plain docs without populated actor; attach the actor
  // object so the socket payload is complete.
  return created.map((doc, index) => ({
    ...toPublicNotification(doc),
    actor: toPublicUser(actor),
    recipientId: docs[index].recipient,
  }));
};

const listForUser = async (organizationId, userId, { unreadOnly = false, limit } = {}) => {
  const query = { organization: organizationId, recipient: userId };
  if (unreadOnly) {
    query.readAt = null;
  }
  const max = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const notifications = await Notification.find(query)
    .populate('actor')
    .sort({ createdAt: -1 })
    .limit(max);
  return notifications.map(toPublicNotification);
};

const countUnread = (organizationId, userId) =>
  Notification.countDocuments({ organization: organizationId, recipient: userId, readAt: null });

const markRead = (id, organizationId, userId) =>
  Notification.updateOne(
    { _id: id, organization: organizationId, recipient: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );

const markAllRead = (organizationId, userId) =>
  Notification.updateMany(
    { organization: organizationId, recipient: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );

const remove = (id, userId) => Notification.deleteOne({ _id: id, recipient: userId });

const removeForMessage = (messageId) => Notification.deleteMany({ message: messageId });

// Marks notifications read for everything the user just read (used when a
// channel/DM is opened so the Activity badge stays in sync).
const markReadForChannel = (organizationId, userId, channelId) =>
  Notification.updateMany(
    { organization: organizationId, recipient: userId, channel: channelId, readAt: null },
    { $set: { readAt: new Date() } },
  );

const markReadForConversation = (organizationId, userId, conversationId) =>
  Notification.updateMany(
    { organization: organizationId, recipient: userId, conversation: conversationId, readAt: null },
    { $set: { readAt: new Date() } },
  );

module.exports = {
  buildSnippet,
  toPublicNotification,
  createForRecipients,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
  remove,
  removeForMessage,
  markReadForChannel,
  markReadForConversation,
};
