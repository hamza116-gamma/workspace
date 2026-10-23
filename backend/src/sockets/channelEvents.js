const { CHANNEL_TYPES } = require('../config/constants');
const channelService = require('../services/channel.service');

const idOf = (ref) => String(ref?._id ?? ref);

// Rename / topic / purpose / archive: public channels go to the org room,
// private channels to each member's user room.
const emitChannelUpdated = async (io, channel) => {
  if (!io || !channel) {
    return;
  }
  const payload = { channelId: String(channel._id), organizationId: String(channel.organization) };
  if (channel.type !== CHANNEL_TYPES.PRIVATE) {
    io.to(`org:${String(channel.organization)}`).emit('channel.updated', payload);
    return;
  }
  const members = await channelService.listMembers(channel._id);
  const rooms = members.map((member) => `user:${idOf(member.user)}`);
  if (rooms.length) {
    io.to(rooms).emit('channel.updated', payload);
  }
};

// Join / leave / add / remove: the affected user's sidebar updates, and the
// channel's open views refresh their member count.
const emitMembershipChanged = (io, channel, userId, member) => {
  if (!io || !channel) {
    return;
  }
  const channelId = String(channel._id);
  io.to(`channel:${channelId}`).emit('channel.updated', {
    channelId,
    organizationId: String(channel.organization),
  });
  io.to(`user:${String(userId)}`).emit('channel.membership.updated', {
    channelId,
    organizationId: String(channel.organization),
    member,
  });
};

module.exports = { emitChannelUpdated, emitMembershipChanged };
