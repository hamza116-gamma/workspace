const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const unreadService = require('../services/unread.service');

const getSummary = asyncHandler(async (req, res) => {
  const summary = await unreadService.summary(req.organization._id, req.user._id);
  success(res, summary);
});

const readChannel = asyncHandler(async (req, res) => {
  await unreadService.markChannelRead(req.organization._id, req.channel._id, req.user._id);
  success(res, { ok: true });
});

const readConversation = asyncHandler(async (req, res) => {
  await unreadService.markConversationRead(
    req.organization._id,
    req.conversation._id,
    req.user._id,
  );
  success(res, { ok: true });
});

module.exports = { getSummary, readChannel, readConversation };
