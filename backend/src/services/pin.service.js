const ChannelPin = require('../models/channelPin.model');
const { AppError } = require('../utils/AppError');

// Pins for a channel, newest first, with the pinned message (and its sender +
// mentions) and the pinner populated.
const listForChannel = (channelId) =>
  ChannelPin.find({ channel: channelId })
    .populate({ path: 'message', populate: ['sender', 'mentionedUserIds'] })
    .populate('pinnedBy')
    .sort({ createdAt: -1 });

const findOne = (channelId, messageId) =>
  ChannelPin.findOne({ channel: channelId, message: messageId })
    .populate({ path: 'message', populate: ['sender', 'mentionedUserIds'] })
    .populate('pinnedBy');

const isPinned = (channelId, messageId) =>
  ChannelPin.exists({ channel: channelId, message: messageId });

const pinMessage = async (organizationId, channel, message, user) => {
  if (String(message.channel) !== String(channel._id)) {
    throw new AppError(400, 'This message does not belong to the channel');
  }
  // Resolves to true only when a new pin was created.
  try {
    await ChannelPin.create({
      organization: organizationId,
      channel: channel._id,
      message: message._id,
      pinnedBy: user._id,
    });
    return true;
  } catch (error) {
    // Already pinned (unique index) is fine.
    if (error.code !== 11000) {
      throw error;
    }
    return false;
  }
};

const unpinMessage = (channelId, messageId) =>
  ChannelPin.deleteOne({ channel: channelId, message: messageId });

const removeForMessage = (messageId) => ChannelPin.deleteMany({ message: messageId });

module.exports = { listForChannel, findOne, isPinned, pinMessage, unpinMessage, removeForMessage };
