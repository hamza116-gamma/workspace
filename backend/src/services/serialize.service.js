const reactionService = require('./reaction.service');
const attachmentService = require('./attachment.service');
const messageService = require('./message.service');
const taskService = require('./task.service');

// Serialize a single message (with the viewer's reactions, its attachments
// and its task card) for any controller that returns messages (messages,
// pins, saved items).
const serializeMessage = async (message, viewerId) => {
  const [reactions, attachments, tasks] = await Promise.all([
    reactionService.getForMessage(message._id, viewerId),
    attachmentService.getForMessage(message._id),
    message.task ? taskService.getByMessageIds([message._id]) : new Map(),
  ]);
  return messageService.toPublicMessage(
    message,
    reactions,
    attachments,
    tasks.get(String(message._id)) || null,
  );
};

const serializeMessages = async (messages, viewerId) => {
  const ids = messages.map((message) => message._id);
  const taskIds = messages.filter((message) => message.task).map((message) => message._id);
  const [reactionMap, attachmentMap, taskMap] = await Promise.all([
    reactionService.getByMessageIds(ids, viewerId),
    attachmentService.getByMessageIds(ids),
    taskService.getByMessageIds(taskIds),
  ]);
  return messages.map((message) =>
    messageService.toPublicMessage(
      message,
      reactionMap.get(String(message._id)) || [],
      attachmentMap.get(String(message._id)) || [],
      taskMap.get(String(message._id)) || null,
    ),
  );
};

module.exports = { serializeMessage, serializeMessages };
