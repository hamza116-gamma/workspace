const Channel = require('../models/channel.model');
const ChannelMember = require('../models/channelMember.model');
const Conversation = require('../models/conversation.model');
const { CHANNEL_TYPES, CHANNEL_MEMBER_STATUS } = require('../config/constants');

// What a user may read in one organization: public channels they were not
// removed from, private channels they are an active member of, and their
// own DMs / group DMs. Search never looks outside this scope.
const loadSearchScope = async (organizationId, userId) => {
  const memberships = await ChannelMember.find(
    { organization: organizationId, user: userId },
    'channel status',
  );
  const removed = [];
  const active = [];
  memberships.forEach((membership) => {
    if (membership.status === CHANNEL_MEMBER_STATUS.REMOVED) {
      removed.push(membership.channel);
    } else {
      active.push(membership.channel);
    }
  });

  const [channels, conversations] = await Promise.all([
    Channel.find({
      organization: organizationId,
      $or: [{ type: CHANNEL_TYPES.PUBLIC, _id: { $nin: removed } }, { _id: { $in: active } }],
    }),
    Conversation.find({ organization: organizationId, 'participants.user': userId }).populate(
      'participants.user',
      'fullName avatarUrl',
    ),
  ]);

  const joined = new Set(active.map(String));
  return {
    channels,
    conversations,
    channelIds: channels.map((channel) => channel._id),
    conversationIds: conversations.map((conversation) => conversation._id),
    isJoined: (channelId) => joined.has(String(channelId)),
  };
};

module.exports = { loadSearchScope };
