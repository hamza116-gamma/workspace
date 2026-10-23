const channelService = require('../services/channel.service');
const threadService = require('../services/thread.service');
const notificationService = require('../services/notification.service');
const { NOTIFICATION_TYPES } = require('../models/notification.model');
const { CHANNEL_NOTIFY } = require('../config/constants');
const User = require('../models/user.model');
const { isDndActive } = require('../utils/dnd');

const idOf = (ref) => String(ref?._id ?? ref);

const isMentioned = (message, userId) => {
  const mentioned = (message.mentionedUserIds || []).some((user) => idOf(user) === String(userId));
  return mentioned || Boolean(message.mentionAll || message.mentionHere);
};

// Slack notification rules, applied per message:
//   DM / group DM  -> all other participants
//   Channel        -> per-member preference (ALL / MENTIONS / MUTE)
//   Thread replies -> thread followers who are still channel members
//                     (unless muted), unless covered by a mention.
// The strongest type wins (MENTION > THREAD_REPLY > DM/CHANNEL).
const channelRecipients = async (message, senderId) => {
  const recipients = new Map();
  const isReply = Boolean(message.parentMessageId);
  const members = await channelService.listMembers(message.channel);
  const memberById = new Map(members.map((member) => [idOf(member.user), member]));

  memberById.forEach((membership, id) => {
    if (id === senderId || membership.notifyPreference === CHANNEL_NOTIFY.MUTE) {
      return;
    }
    if (isMentioned(message, id)) {
      recipients.set(id, { id, type: NOTIFICATION_TYPES.MENTION });
    } else if (membership.notifyPreference === CHANNEL_NOTIFY.ALL && !isReply) {
      recipients.set(id, { id, type: NOTIFICATION_TYPES.CHANNEL });
    }
  });

  if (isReply) {
    const followers = await threadService.listFollowers(message.parentMessageId);
    followers.forEach((follower) => {
      const id = idOf(follower.user);
      const membership = memberById.get(id);
      // Ex-members keep their follow row but get no thread notifications.
      if (id === senderId || !membership || membership.notifyPreference === CHANNEL_NOTIFY.MUTE) {
        return;
      }
      if (isMentioned(message, id)) {
        recipients.set(id, { id, type: NOTIFICATION_TYPES.MENTION });
      } else if (!recipients.has(id)) {
        recipients.set(id, { id, type: NOTIFICATION_TYPES.THREAD_REPLY });
      }
    });
  }
  return [...recipients.values()];
};

// Participants who muted the DM get no notifications from it.
const conversationRecipients = (conversation, senderId) =>
  (conversation?.participants || [])
    .filter((participant) => !participant.muted)
    .map((participant) => idOf(participant.user))
    .filter((id) => id !== senderId)
    .map((id) => ({ id, type: NOTIFICATION_TYPES.DM }));

// Recipient ids (strings) whose Do Not Disturb is active right now.
const dndRecipients = async (ids) => {
  if (ids.length === 0) {
    return new Set();
  }
  const users = await User.find({ _id: { $in: ids }, dndUntil: { $gt: new Date() } }, 'dndUntil');
  return new Set(users.filter((user) => isDndActive(user)).map((user) => String(user._id)));
};

const notify = async (io, { message, actor, organizationId, conversation }) => {
  if (!message) {
    return;
  }
  const senderId = String(actor._id);
  const recipients = message.channel
    ? await channelRecipients(message, senderId)
    : conversationRecipients(conversation, senderId);
  if (recipients.length === 0) {
    return;
  }
  const created = await notificationService.createForRecipients(
    organizationId,
    message,
    actor,
    recipients,
  );
  if (!io) {
    return;
  }
  // DND: notifications are still stored (Activity + badges stay right) but
  // delivered silently (no desktop alert / sound).
  const snoozed = await dndRecipients(created.map((notification) => notification.recipientId));
  created.forEach((notification) => {
    const recipientId = String(notification.recipientId);
    io.to(`user:${recipientId}`).emit('notification.created', {
      organizationId: String(organizationId),
      silent: snoozed.has(recipientId),
      notification: { ...notification, recipientId: undefined },
    });
  });
};

// Unread badges update live for every recipient except the sender. Events
// carry organizationId so clients ignore other workspaces' events.
const emitUnread = async (io, { message, actor, organizationId, conversation }) => {
  if (!io || !message) {
    return;
  }
  let recipients = [];
  if (message.channel) {
    const members = await channelService.listMembers(message.channel);
    recipients = members.map((member) => idOf(member.user));
  } else {
    recipients = (conversation?.participants || []).map((participant) => idOf(participant.user));
  }
  const mentioned = new Set((message.mentionedUserIds || []).map(idOf));
  const channelMention = Boolean(message.channel && (message.mentionAll || message.mentionHere));
  const senderId = String(actor._id);

  [...new Set(recipients)].forEach((id) => {
    if (id === senderId) {
      return;
    }
    io.to(`user:${id}`).emit('unread.updated', {
      organizationId: String(organizationId),
      channelId: message.channel ? String(message.channel) : null,
      conversationId: message.conversation ? String(message.conversation) : null,
      mention: channelMention || mentioned.has(id),
    });
  });
};

module.exports = { notify, emitUnread };
