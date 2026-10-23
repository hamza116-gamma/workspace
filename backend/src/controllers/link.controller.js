const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const linkService = require('../services/link.service');

const listChannel = asyncHandler(async (req, res) => {
  const links = await linkService.listForChannel(req.channel._id);
  success(res, { links });
});

const listConversation = asyncHandler(async (req, res) => {
  const links = await linkService.listForConversation(req.conversation._id);
  success(res, { links });
});

module.exports = { listChannel, listConversation };
