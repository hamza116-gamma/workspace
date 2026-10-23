const reactionService = require('./reaction.service');
const attachmentService = require('./attachment.service');
const messageService = require('./message.service');

// Serialize a single message (with the viewer's reactions and its attachments)
// for any controller that returns messages (messages, pins, saved items).
const serializeMessage = async (message, viewerId) => {
  const [reactions, attachments] = await Promise.all([
    reactionService.getForMessage(message._id, viewerId),
    attachmentService.getForMessage(message._id),
  ]);
  return messageService.toPublicMessage(message, reactions, attachments);
};

const serializeMessages = async (messages, viewerId) => {
  const ids = messages.map((message) => message._id);
  const [reactionMap, attachmentMap] = await Promise.all([
    reactionService.getByMessageIds(ids, viewerId),
    attachmentService.getByMessageIds(ids),
  ]);
  return messages.map((message) =>
    messageService.toPublicMessage(
      message,
      reactionMap.get(String(message._id)) || [],
      attachmentMap.get(String(message._id)) || [],
    ),
  );
};

module.exports = { serializeMessage, serializeMessages };
