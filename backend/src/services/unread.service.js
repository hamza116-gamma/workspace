const Message = require('../models/message.model');
const Channel = require('../models/channel.model');
const ChannelMember = require('../models/channelMember.model');
const Conversation = require('../models/conversation.model');
const notificationService = require('./notification.service');
const { CHANNEL_STATUS, CHANNEL_MEMBER_STATUS } = require('../config/constants');

// Counts messages the user hasn't read: not their own, not deleted, and
// excluding thread replies unless also sent to the channel/DM.
const unreadFilters = (userId) => [
  { deletedAt: null },
  { sender: { $ne: userId } },
  { $or: [{ parentMessageId: null }, { alsoSentToChannel: true }] },
];

const countForChannel = async (channelId, userId, since) => {
  const base = unreadFilters(userId);
  if (since) {
    base.push({ createdAt: { $gt: since } });
  }

  const [unread, mentions] = await Promise.all([
    Message.countDocuments({ channel: channelId, $and: base }),
    Message.countDocuments({
      channel: channelId,
      $and: [
        ...base,
        { $or: [{ mentionedUserIds: userId }, { mentionAll: true }, { mentionHere: true }] },
      ],
    }),
  ]);

  return { unread, mentions };
};

const countForConversation = async (conversationId, userId, since) => {
  const base = unreadFilters(userId);
  if (since) {
    base.push({ createdAt: { $gt: since } });
  }
  return Message.countDocuments({ conversation: conversationId, $and: base });
};

// Unread summary for the sidebar: per-channel (unread + mentions), per-DM
// (unread) and totals.
const summary = async (organizationId, userId) => {
  const memberships = await ChannelMember.find({
    organization: organizationId,
    user: userId,
    status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
  }).select('channel lastReadAt');

  const channelIds = memberships.map((membership) => membership.channel);
  const byChannel = new Map(
    memberships.map((membership) => [String(membership.channel), membership]),
  );

  const channels = await Channel.find({
    _id: { $in: channelIds },
    status: CHANNEL_STATUS.ACTIVE,
  }).select('name type');

  const channelResults = await Promise.all(
    channels.map(async (channel) => {
      const membership = byChannel.get(String(channel._id));
      const counts = await countForChannel(channel._id, userId, membership?.lastReadAt);
      return { channelId: String(channel._id), ...counts };
    }),
  );

  const conversations = await Conversation.find({
    organization: organizationId,
    'participants.user': userId,
  }).select('participants');

  const conversationResults = await Promise.all(
    conversations.map(async (conversation) => {
      const participant = conversation.participants.find(
        (item) => String(item.user) === String(userId),
      );
      const unread = await countForConversation(conversation._id, userId, participant?.lastReadAt);
      return { conversationId: String(conversation._id), unread };
    }),
  );

  const totals = {
    unread:
      channelResults.reduce((sum, item) => sum + item.unread, 0) +
      conversationResults.reduce((sum, item) => sum + item.unread, 0),
    mentions: channelResults.reduce((sum, item) => sum + item.mentions, 0),
  };

  return { channels: channelResults, conversations: conversationResults, totals };
};

const markChannelRead = async (organizationId, channelId, userId) => {
  await ChannelMember.updateOne(
    { channel: channelId, user: userId },
    { $set: { lastReadAt: new Date() } },
  );
  // Viewing the channel also clears its Activity notifications (Slack).
  await notificationService.markReadForChannel(organizationId, userId, channelId);
};

const markConversationRead = async (organizationId, conversationId, userId) => {
  await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $set: { 'participants.$.lastReadAt': new Date() } },
  );
  await notificationService.markReadForConversation(organizationId, userId, conversationId);
};

module.exports = { summary, markChannelRead, markConversationRead };
