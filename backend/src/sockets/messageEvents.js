const attachmentService = require('../services/attachment.service');
const messageService = require('../services/message.service');
const { serializeMessage } = require('../services/serialize.service');

// Live payloads are viewer-neutral (viewerId null): clients derive "mine"
// from reaction.users. Never broadcast a payload serialized for the actor.
const serializeLive = (message) => serializeMessage(message, null);

const chatRoomFor = (message) =>
  message.channel ? `channel:${message.channel}` : `conversation:${message.conversation}`;

const threadRootOf = (message) => message.parentMessageId || message._id;

// Edits / deletes / reactions reach the chat room AND the thread room.
const emitToMessageRooms = (io, message, event, payload) => {
  if (!io || !message) {
    return;
  }
  io.to(chatRoomFor(message))
    .to(`thread:${threadRootOf(message)}`)
    .emit(event, payload);
};

const emitThreadUpdated = async (io, rootId, organizationId) => {
  const root = await messageService.findByIdForOrg(rootId, organizationId);
  if (!io || !root) {
    return;
  }
  const payload = { message: await serializeLive(root) };
  io.to(chatRoomFor(root)).to(`thread:${root._id}`).emit('thread.updated', payload);
};

const emitCreated = async (io, message, organizationId) => {
  if (!io || !message) {
    return;
  }
  const attachments = await attachmentService.getForMessage(message._id);
  const payload = { message: messageService.toPublicMessage(message, [], attachments) };

  if (!message.parentMessageId) {
    io.to(chatRoomFor(message)).emit('message.created', payload);
    return;
  }
  const rooms = [`thread:${message.parentMessageId}`];
  if (message.alsoSentToChannel) {
    rooms.push(chatRoomFor(message));
  }
  io.to(rooms).emit('message.created', payload);
  await emitThreadUpdated(io, message.parentMessageId, organizationId);
};

module.exports = { serializeLive, chatRoomFor, emitToMessageRooms, emitThreadUpdated, emitCreated };
