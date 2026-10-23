const User = require('../models/user.model');
const { AppError } = require('../utils/AppError');
const { MEMBER_STATUS } = require('../config/constants');
const organizationService = require('./organization.service');
const channelService = require('./channel.service');
const conversationService = require('./conversation.service');

/**
 * Re-checks, at send time, everything a normal send checks: the author is
 * still an active workspace member and may still write to the channel / is
 * still in the conversation. Returns { user, target } for postMessage.
 */
const resolveSendContext = async (item) => {
  const membership = await organizationService.getMembership(item.user, item.organization);
  if (!membership || membership.status !== MEMBER_STATUS.ACTIVE) {
    throw new AppError(403, 'You are no longer a member of this workspace');
  }
  const user = await User.findById(item.user);
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (item.channel) {
    const channel = await channelService.findById(item.channel, item.organization);
    if (!channel) {
      throw new AppError(404, 'Channel not found');
    }
    const { membership: channelMembership } = await channelService.getAccessContext(
      channel,
      user._id,
    );
    channelService.assertCanWrite(channel, channelMembership);
    return { user, target: { channel } };
  }

  const conversation = await conversationService.findByIdForOrg(
    item.conversation,
    item.organization,
  );
  if (!conversation || !conversationService.getParticipant(conversation, user._id)) {
    throw new AppError(403, 'You are not part of this conversation');
  }
  return { user, target: { conversation } };
};

module.exports = { resolveSendContext };
