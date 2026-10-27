const attachmentService = require('../services/attachment.service');
const messageService = require('../services/message.service');
const { serializeMessage } = require('../services/serialize.service');

// Live payloads are viewer-neutral (viewerId null): clients derive "mine"
// from reaction.users. Never broadcast a payload serialized for the actor.
const serializeLive = (message) => serializeMessage(message, null);

const chatRoomFor = (message) =>
  message.channel ? `channel:${message.channel}` : `conversation:${message.conversation}`;

const threadRootOf = (message) => message.parentMessageId || message._id;

// Rooms that may hear about a message. A ticket's own thread (hidden anchor
// and its comments) is never sent to the chat room: only to the thread room
// of people who opened that ticket. This is the one place that rule lives.
const roomsFor = (message, { chat = true } = {}) => {
  const rooms = [`thread:${threadRootOf(message)}`];
  if (chat && !message.ticketThread) {
    rooms.push(chatRoomFor(message));
  }
  return rooms;
};

// Edits / deletes / reactions reach the chat room AND the thread room.
const emitToMessageRooms = (io, message, event, payload) => {
  if (!io || !message) {
    return;
  }
  io.to(roomsFor(message)).emit(event, payload);
};

const emitThreadUpdated = async (io, rootId, organizationId) => {
  const root = await messageService.findByIdForOrg(rootId, organizationId);
  if (!io || !root) {
    return;
  }
  const payload = { message: await serializeLive(root) };
  io.to(roomsFor(root)).emit('thread.updated', payload);
};

const emitCreated = async (io, message, organizationId) => {
  if (!io || !message) {
    return;
  }
  const attachments = await attachmentService.getForMessage(message._id);
  const payload = { message: messageService.toPublicMessage(message, [], attachments) };

  if (!message.parentMessageId) {
    if (!message.ticketThread) {
      io.to(chatRoomFor(message)).emit('message.created', payload);
    }
    return;
  }
  io.to(roomsFor(message, { chat: message.alsoSentToChannel })).emit('message.created', payload);
  await emitThreadUpdated(io, message.parentMessageId, organizationId);
};

module.exports = {
  serializeLive,
  chatRoomFor,
  roomsFor,
  emitToMessageRooms,
  emitThreadUpdated,
  emitCreated,
};
