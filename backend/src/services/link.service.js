const Message = require('../models/message.model');
const { toPublicUser } = require('./user.service');

const MAX_MESSAGES_SCANNED = 200;

const toPublicLink = (message, url, index) => ({
  id: `${message._id}-${index}`,
  url,
  messageId: String(message._id),
  sender:
    message.sender && message.sender.fullName
      ? toPublicUser(message.sender)
      : { id: String(message.sender) },
  createdAt: message.createdAt,
});

const list = async (target) => {
  const messages = await Message.find({
    ...target,
    deletedAt: null,
    'links.0': { $exists: true },
  })
    .populate('sender')
    .sort({ createdAt: -1 })
    .limit(MAX_MESSAGES_SCANNED);

  const items = [];
  for (const message of messages) {
    (message.links || []).forEach((url, index) => {
      items.push(toPublicLink(message, url, index));
    });
  }
  return items;
};

const listForChannel = (channelId) => list({ channel: channelId });
const listForConversation = (conversationId) => list({ conversation: conversationId });

module.exports = { listForChannel, listForConversation };
