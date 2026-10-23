const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const messageService = require('../services/message.service');
const pinService = require('../services/pin.service');
const { serializeMessage } = require('../services/serialize.service');
const { toPublicUser } = require('../services/user.service');

const getIo = (req) => req.app.get('io');

const serializePin = async (pin, viewerId) => ({
  id: pin._id,
  channelId: String(pin.channel),
  messageId: String(pin.message?._id ?? pin.message),
  pinnedBy: pin.pinnedBy && pin.pinnedBy.fullName ? toPublicUser(pin.pinnedBy) : null,
  createdAt: pin.createdAt,
  message: await serializeMessage(pin.message, viewerId),
});

const notify = (req, messageId, pinned) => {
  const io = getIo(req);
  if (!io) {
    return;
  }
  io.to(`channel:${req.channel._id}`).emit('pin.updated', {
    channelId: String(req.channel._id),
    messageId: String(messageId),
    pinned,
  });
};

const list = asyncHandler(async (req, res) => {
  const pins = await pinService.listForChannel(req.channel._id);
  const items = await Promise.all(pins.map((pin) => serializePin(pin, req.user._id)));
  success(res, { pins: items });
});

const pin = asyncHandler(async (req, res) => {
  const message = await messageService.findByIdForOrg(req.params.messageId, req.organization._id);
  if (!message || message.deletedAt) {
    throw new AppError(404, 'Message not found');
  }
  await messageService.assertAccess(message, req.user._id);
  const created = await pinService.pinMessage(req.organization._id, req.channel, message, req.user);

  const saved = await pinService.findOne(req.channel._id, message._id);
  if (created) {
    notify(req, message._id, true);
  }
  success(res, { pinned: true, pin: saved ? await serializePin(saved, req.user._id) : null });
});

const unpin = asyncHandler(async (req, res) => {
  const result = await pinService.unpinMessage(req.channel._id, req.params.messageId);
  if (result.deletedCount > 0) {
    notify(req, req.params.messageId, false);
  }
  success(res, { pinned: false });
});

module.exports = { list, pin, unpin };
